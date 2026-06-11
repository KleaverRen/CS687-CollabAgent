const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const { authenticate } = require("../../middleware/auth");
const agentGate = require("../../middleware/agentGate");
const eventBroker = require("../../services/eventBroker");
const generationService = require("../../services/generationService");
const { recordProjectEvent } = require("../../services/notificationService");

function requireStudentAgent(req, res, next) {
  if (req.user?.role !== "student") {
    return res
      .status(403)
      .json({ error: "Task Orchestrator is available to students only." });
  }
  next();
}

function normalizePriority(priority) {
  const normalized = String(priority || "medium").toLowerCase();
  if (normalized === "urgent") return "critical";
  return ["low", "medium", "high", "critical"].includes(normalized)
    ? normalized
    : "medium";
}

/**
 * Detect self-assignment phrases in a natural-language request.
 * Returns true when the user explicitly asks to be assigned the task.
 */
function detectSelfAssignment(text) {
  const lower = String(text || "").toLowerCase();
  return (
    /\b(assign|allocate|delegate)\b.*\b(me|myself|self)\b/.test(lower) ||
    /\b(me|myself|self)\b.*\b(assign|allocate|delegate)\b/.test(lower) ||
    /\bfor me\b/.test(lower) ||
    /\bmy task\b/.test(lower)
  );
}

async function canStudentWorkOnProject(user, projectId) {
  if (user.role !== "student") return false;
  const result = await pool.query(
    `SELECT 1 FROM project_members
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, user.id],
  );
  return result.rows.length > 0;
}

async function isProjectArchived(projectId) {
  const result = await pool.query("SELECT status FROM projects WHERE id = $1", [
    projectId,
  ]);
  return result.rows[0]?.status === "archived";
}

async function resolveAssigneeId(assigneeName, projectId, currentUser) {
  const normalized = String(assigneeName || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  if (
    [
      "me",
      "myself",
      "self",
      "i",
      currentUser.full_name?.toLowerCase(),
      currentUser.email?.toLowerCase(),
    ].includes(normalized)
  ) {
    return currentUser.id;
  }

  const result = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN project_members pm ON pm.user_id = u.id
     WHERE pm.project_id = $1
       AND (LOWER(u.full_name) = $2 OR LOWER(u.email) = $2)
     LIMIT 1`,
    [projectId, normalized],
  );

  return result.rows[0]?.id || null;
}

function parseWeekdayDeadline(request) {
  const weekdays = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const match = String(request || "")
    .toLowerCase()
    .match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (!match) return null;

  const today = new Date();
  const targetDay = weekdays[match[1]];
  const daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
  const target = new Date(today);
  target.setDate(today.getDate() + daysUntil);
  return target.toISOString().slice(0, 10);
}

function parseInlineDeadline(request) {
  const text = String(request || "");
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const now = new Date();
    const year = slashMatch[3]
      ? Number(
          slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3],
        )
      : now.getFullYear();
    const month = String(Number(slashMatch[1])).padStart(2, "0");
    const day = String(Number(slashMatch[2])).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }

  return parseWeekdayDeadline(text);
}

function extractQuotedTaskTitle(request) {
  const quoted = String(request || "").match(/["“”']([^"“”']+)["“”']/);
  return quoted?.[1]?.trim() || null;
}

function looksLikeExistingTaskUpdate(request) {
  const text = String(request || "").toLowerCase();
  return (
    /\b(assign|reassign|deadline|due|set|update|change)\b/.test(text) &&
    /\b(task|todo|to do|deadline|due)\b/.test(text)
  );
}

async function getProjectTodoTasks(projectId) {
  const result = await pool.query(
    `SELECT t.*, u.full_name AS assignee_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.project_id = $1 AND t.status = 'todo'
     ORDER BY t.created_at DESC`,
    [projectId],
  );
  return result.rows;
}

function findBestTaskMatch(tasks, requestedTitle) {
  const normalizedTitle = String(requestedTitle || "")
    .trim()
    .toLowerCase();
  if (!normalizedTitle) return null;

  return (
    tasks.find((task) => task.title.toLowerCase() === normalizedTitle) ||
    tasks.find((task) => task.title.toLowerCase().includes(normalizedTitle)) ||
    tasks.find((task) => normalizedTitle.includes(task.title.toLowerCase())) ||
    null
  );
}

function findImplicitTaskMatch(tasks, request, currentUser) {
  const text = String(request || "").toLowerCase();
  if (!/\b(my|me|assigned to me)\b/.test(text)) return null;

  const assignedToUser = tasks.filter(
    (task) => task.assigned_to === currentUser.id,
  );
  if (assignedToUser.length === 1) return assignedToUser[0];

  const unassigned = tasks.filter((task) => !task.assigned_to);
  if (/\bunassigned\b/.test(text) && unassigned.length === 1)
    return unassigned[0];

  return null;
}

function looksLikeTaskBreakdownRequest(request) {
  const text = String(request || "").toLowerCase();
  const asksForManyTasks =
    /\b(task list|tasks|workstreams?|breakdown|actionable|comprehensive|for each task)\b/.test(
      text,
    );
  const planningIntent =
    /\b(generate|create|draft|plan|need|provide|structure|develop|prepare)\b/.test(
      text,
    );
  const hasEnumeratedWorkstreams =
    (text.match(/\b\d+\.\s+[a-z]/g) || []).length >= 2;

  return asksForManyTasks && (planningIntent || hasEnumeratedWorkstreams);
}

/**
 * Detects if the user wants tasks based on existing indexed knowledge.
 */
function looksLikeRAGAugmentedTaskRequest(request) {
  const text = String(request || "").toLowerCase();
  return (
    /\b(based on|from|using|referencing|according to)\b.*\b(docs?|documentation|notes|knowledge|research|proposal|paper|files?)\b/.test(
      text,
    ) ||
    /\bphase\s*\d+\b/.test(text) ||
    /\b(indexed|ingested|uploaded|knowledge base|project plan|deployment plan|requirements|feasibility)\b/.test(
      text,
    )
  );
}

/**
 * Extract stable search terms for cross-agent retrieval.
 */
function extractKnowledgeReferenceTerms(request) {
  const stopWords = new Set([
    "about",
    "actionable",
    "agent",
    "all",
    "and",
    "based",
    "breakdown",
    "comprehensive",
    "create",
    "description",
    "document",
    "documentation",
    "each",
    "for",
    "from",
    "generate",
    "give",
    "indexed",
    "into",
    "list",
    "need",
    "please",
    "project",
    "provide",
    "task",
    "tasks",
    "the",
    "this",
    "title",
    "using",
    "with",
    "workstream",
    "workstreams",
  ]);

  const text = String(request || "").toLowerCase();
  const terms = new Set(
    text
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !stopWords.has(term)),
  );

  const phaseMatches = text.matchAll(/\bphase\s*(\d+)\b/g);
  for (const match of phaseMatches) {
    terms.add("phase");
    terms.add(match[1]);
    terms.add(`phase ${match[1]}`);
  }

  return [...terms];
}

function scoreKnowledgeDocument(row, queryTerms) {
  const title = String(row.title || "");
  const content = String(row.content || "");
  const metadata = row.metadata || {};
  const metadataText = [
    metadata.description,
    metadata.summary,
    metadata.originalName,
    metadata.source,
  ]
    .filter(Boolean)
    .join(" ");
  const titleText = title.toLowerCase();
  const searchable = `${title}\n${metadataText}\n${content}`.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    const normalizedTerm = String(term || "").toLowerCase();
    if (!normalizedTerm) continue;
    if (titleText.includes(normalizedTerm)) score += 5;
    if (metadataText.toLowerCase().includes(normalizedTerm)) score += 3;
    if (searchable.includes(normalizedTerm)) score += 1;
  }

  const phaseMatch = String(queryTerms.join(" ")).match(/\bphase\s*(\d+)\b/);
  if (phaseMatch && searchable.includes(`phase ${phaseMatch[1]}`)) score += 8;

  if (row.embedding_status === "indexed" || row.indexed) score += 2;

  return score;
}

/**
 * Retrieve relevant Knowledge Agent documents for Task Orchestrator.
 */
async function fetchKnowledgeContext(projectId, query) {
  try {
    const queryTerms = extractKnowledgeReferenceTerms(query);
    if (queryTerms.length === 0) return { context: "", sources: [] };

    const result = await pool.query(
      `SELECT id, title, content, indexed, embedding_status, metadata, created_at
       FROM documents
       WHERE project_id = $1
         AND content IS NOT NULL
         AND char_length(trim(content)) > 0
         AND COALESCE(embedding_status, 'pending') <> 'failed'
       ORDER BY created_at DESC
       LIMIT 30`,
      [projectId],
    );

    const ranked = result.rows
      .map((row) => ({
        row,
        score: scoreKnowledgeDocument(row, queryTerms),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (ranked.length === 0) return { context: "", sources: [] };

    return {
      context: ranked
        .map(({ row }) => {
          const metadata = row.metadata || {};
          const description = metadata.description || metadata.summary || "";
          return [
            `[Document: ${row.title}]`,
            description ? `Description: ${description}` : null,
            String(row.content || "").substring(0, 2500),
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n---\n\n"),
      sources: ranked.map(({ row, score }) => ({
        id: row.id,
        title: row.title,
        status: row.embedding_status,
        score,
      })),
    };
  } catch (err) {
    console.error("[TaskAgent] Knowledge retrieval failed:", err);
    return { context: "", sources: [] };
  }
}

/**
 * Detect if the user is asking for recommendations or next steps.
 */
function looksLikeRecommendationRequest(request) {
  const text = String(request || "").toLowerCase();
  return (
    /\b(recommend|suggest|next steps|what should i do|what tasks|pick for me)\b/.test(
      text,
    ) && /\b(i|me|my|next)\b/.test(text)
  );
}

function normalizeGeneratedTask(task, index) {
  const complexity = String(
    task.complexity || task.effort || "Medium",
  ).toLowerCase();
  const priority =
    task.priority ||
    (complexity === "high" ? "high" : complexity === "low" ? "low" : "medium");
  const title = String(
    task.title || task.task_title || `Generated task ${index + 1}`,
  ).trim();
  const description = String(task.description || "").trim();
  const blocker = String(task.potential_blocker || task.blocker || "").trim();
  const workstream = String(task.workstream || "General").trim();

  return {
    title,
    description: [
      description,
      workstream ? `Workstream: ${workstream}` : "",
      task.complexity || task.effort
        ? `Complexity/Effort: ${task.complexity || task.effort}`
        : "",
      blocker ? `Potential Blocker: ${blocker}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    priority: normalizePriority(priority),
    assignee_name: task.assignee_name || null,
    metadata: {
      source: "ai_workbench_bulk_generation",
      workstream,
      complexity: task.complexity || task.effort || "Medium",
      potential_blocker: blocker,
      order: index + 1,
    },
  };
}

function normalizeSingleTaskDraft(draft, request) {
  const fallbackTitle = String(request || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return {
    title: String(draft?.title || fallbackTitle || "New task").trim(),
    priority: normalizePriority(draft?.priority),
    assignee_name: draft?.assignee_name || null,
  };
}

function buildDuplicateTaskMetadataFilter(metadata, paramIndex) {
  const source = metadata?.source;
  const order = metadata?.order;
  if (!source || order === undefined || order === null) return "";

  return `AND metadata->>'source' = $${paramIndex}
       AND metadata->>'order' = $${paramIndex + 1}`;
}

function fallbackPhaseOneTasks() {
  return [
    {
      workstream: "Use Case & Agent Role Definition",
      title: "Map data science workflow bottlenecks",
      description:
        "Interview data scientists, ML engineers, and analytics stakeholders to identify repetitive EDA, feature engineering, model validation, and reporting bottlenecks. Deliver a ranked bottleneck inventory with frequency, business impact, and automation suitability.",
      complexity: "Medium",
      potential_blocker:
        "Stakeholders may describe symptoms rather than measurable workflow delays.",
    },
    {
      workstream: "Use Case & Agent Role Definition",
      title: "Define candidate agent personas and responsibilities",
      description:
        "Translate the highest-value bottlenecks into candidate agent roles such as EDA Agent, Feature Engineering Agent, Model Validation Agent, and Governance Reviewer Agent. Deliver a responsibility matrix covering inputs, outputs, required tools, escalation rules, and ownership boundaries.",
      complexity: "High",
      potential_blocker:
        "Agent responsibilities may overlap without clear handoff criteria.",
    },
    {
      workstream: "Use Case & Agent Role Definition",
      title: "Design initial agent collaboration workflows",
      description:
        "Map how specialized agents should coordinate across EDA, feature selection, experiment tracking, model validation, and human approval. Deliver sequence diagrams or swimlanes for the top three Phase 1 candidate workflows.",
      complexity: "High",
      potential_blocker:
        "Workflow dependencies may expose missing human approval or rollback steps.",
    },
    {
      workstream: "Technical Feasibility & Architecture Assessment",
      title: "Evaluate multi-agent orchestration frameworks",
      description:
        "Compare CrewAI, AutoGen, and LangGraph against requirements for state management, tool calling, observability, guardrails, and human-in-the-loop controls. Deliver a decision matrix with a recommended prototype framework and fallback option.",
      complexity: "High",
      potential_blocker:
        "Framework maturity and API changes may make long-term support hard to assess.",
    },
    {
      workstream: "Technical Feasibility & Architecture Assessment",
      title: "Assess context window and retrieval constraints",
      description:
        "Analyze how large datasets, feature catalogs, notebooks, and experiment histories fit into LLM context and retrieval workflows. Deliver recommended chunking, summarization, metadata, and retrieval patterns for massive data science artifacts.",
      complexity: "High",
      potential_blocker:
        "Dataset and notebook artifacts may be too large or inconsistent for direct LLM ingestion.",
    },
    {
      workstream: "Technical Feasibility & Architecture Assessment",
      title: "Estimate API and compute requirements",
      description:
        "Model expected LLM calls, embedding workloads, orchestration runtime needs, and AWS compute resources for the Phase 1 candidate workflows. Deliver a capacity estimate with peak-load assumptions and required cloud services.",
      complexity: "Medium",
      potential_blocker:
        "Token and compute usage may vary widely by agent loop behavior.",
    },
    {
      workstream: "Data Readiness & Security Compliance",
      title: "Audit data access patterns for autonomous agents",
      description:
        "Review Snowflake schemas, feature stores, notebooks, and source systems that agents may need to access. Deliver an access-control matrix specifying least-privilege permissions, data classifications, and approval requirements.",
      complexity: "High",
      potential_blocker:
        "Existing data permissions may be role-based for humans rather than scoped for autonomous services.",
    },
    {
      workstream: "Data Readiness & Security Compliance",
      title: "Validate governance and privacy controls",
      description:
        "Assess whether agents could expose sensitive data through prompts, logs, tool outputs, or generated artifacts. Deliver a compliance checklist covering PII handling, prompt logging, audit trails, retention, and redaction controls.",
      complexity: "High",
      potential_blocker:
        "Current logging and observability systems may capture sensitive prompt context by default.",
    },
    {
      workstream: "Data Readiness & Security Compliance",
      title: "Evaluate real-time pipeline compatibility",
      description:
        "Review current batch and streaming pipelines to determine whether agents can safely consume fresh data and trigger downstream analysis. Deliver compatibility findings and integration constraints for Snowflake, AWS services, and Python workflows.",
      complexity: "Medium",
      potential_blocker:
        "Pipeline SLAs may not tolerate additional agent-driven latency or retries.",
    },
    {
      workstream: "Cost, ROI, & Risk Analysis",
      title: "Estimate token and infrastructure costs",
      description:
        "Build a cost model for LLM inference, embeddings, vector storage, orchestration services, monitoring, and AWS compute. Deliver monthly cost estimates under low, expected, and high usage scenarios.",
      complexity: "Medium",
      potential_blocker:
        "Agent retries and iterative reasoning loops may make token consumption unpredictable.",
    },
    {
      workstream: "Cost, ROI, & Risk Analysis",
      title: "Define ROI metrics and success criteria",
      description:
        "Identify measurable outcomes such as reduced EDA cycle time, faster feature engineering, improved model validation coverage, and reduced handoff delays. Deliver a Phase 1 scorecard with baseline metrics, target improvements, and measurement owners.",
      complexity: "Medium",
      potential_blocker:
        "Baseline productivity metrics may not currently be tracked consistently.",
    },
    {
      workstream: "Cost, ROI, & Risk Analysis",
      title: "Document agent failure modes and mitigations",
      description:
        "Map risks including hallucinated analysis, tool misuse, infinite loops, unsafe code generation, data leakage, and conflicting agent recommendations. Deliver a risk register with severity, detection signals, mitigation controls, and escalation paths.",
      complexity: "High",
      potential_blocker:
        "Failure modes may span technical, governance, and operating model ownership boundaries.",
    },
  ];
}

// POST /api/agents/task/parse - Parse NL task request into a draft
router.post("/parse", authenticate, requireStudentAgent, async (req, res) => {
  try {
    const { request, projectId, provider = null } = req.body;

    if (!request || !projectId) {
      return res
        .status(400)
        .json({ error: "Request text and projectId are required" });
    }
    if (!(await canStudentWorkOnProject(req.user, projectId))) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized" });
    }

    if (looksLikeTaskBreakdownRequest(request)) {
      const fallbackTasks = fallbackPhaseOneTasks();
      let knowledgeContext = "";
      let knowledgeSources = [];

      if (looksLikeRAGAugmentedTaskRequest(request)) {
        const knowledgeResult = await fetchKnowledgeContext(projectId, request);
        knowledgeContext = knowledgeResult.context;
        knowledgeSources = knowledgeResult.sources;
        if (knowledgeContext) {
          console.log(
            "[TaskAgent] Augmented generation with project knowledge.",
          );
        }
      }

      const systemPrompt = `You are the CollabAgent Task Management AI.
Generate a comprehensive but actionable task breakdown from the user's project planning request.
${knowledgeContext ? `\nUSE THIS PROJECT CONTEXT FOR ACCURACY:\n${knowledgeContext}\n` : ""}
Return strictly valid JSON in this exact shape:
{
  "tasks": [
    {
      "workstream": "string",
      "title": "action-oriented task title starting with a verb",
      "description": "2-3 sentence execution detail and required deliverable",
      "complexity": "High | Medium | Low",
      "potential_blocker": "one specific technical or organizational blocker",
      "priority": "low | medium | high | critical",
      "assignee_name": null
    }
  ]
}
Create 10 to 16 tasks. Do not include markdown.`;

      const parsed = await generationService.generateJson(
        systemPrompt,
        request,
        { tasks: fallbackTasks },
        provider,
      );
      const rawTasks =
        Array.isArray(parsed?.tasks) && parsed.tasks.length
          ? parsed.tasks
          : fallbackTasks;
      const drafts = rawTasks.slice(0, 20).map(normalizeGeneratedTask);

      return res.json({
        drafts,
        requires_confirmation: true,
        knowledge_sources: knowledgeSources,
        message:
          knowledgeSources.length > 0
            ? "Please review and confirm these generated task drafts before creation. Relevant project knowledge was used."
            : "Please review and confirm these generated task drafts before creation.",
      });
    }

    if (looksLikeRecommendationRequest(request)) {
      const [projectRes, todoTasks] = await Promise.all([
        pool.query("SELECT name, description FROM projects WHERE id = $1", [
          projectId,
        ]),
        getProjectTodoTasks(projectId),
      ]);

      const project = projectRes.rows[0];
      const taskListContext = todoTasks
        .slice(0, 20)
        .map(
          (t) =>
            `- "${t.title}" | Priority: ${t.priority} | Status: ${t.assigned_to ? "Assigned" : "Unassigned"}`,
        )
        .join("\n");

      const systemPrompt = `You are the CollabAgent Task Advisor. 
Analyze the "Current Tasks" list for project "${project?.name}". Your goal is to recommend the specific number of tasks the user should work on next.

Rules:
1. PRIORITIZE EXISTING: You MUST first look at the "Current Tasks (Existing)" list. Find tasks where Status is "Unassigned". Recommend these first.
2. EXACT TITLES: For tasks picked from the existing list, you MUST use the EXACT title as written. Do not change punctuation or casing.
3. QUANTITY: If the user specified a number (e.g. "next 3 tasks"), provide exactly that many. Default to 3 if unspecified.
4. SUPPLEMENT: Only if there are fewer than the requested number of unassigned tasks available, suggest NEW tasks that align with the project goals: "${project?.description}".
5. Return strictly valid JSON in this exact shape:
 {
  "message": "A brief encouraging summary of why these tasks were chosen.",
  "tasks": [
    {
      "title": "Action-oriented title",
      "description": "Specific detail on what to do",
      "priority": "low | medium | high | critical",
      "assignee_name": "me"
    }
  ]
}`;

      const userContext = `Project: ${project?.name}\nDescription: ${project?.description}\n\nCurrent Tasks (Existing):\n${taskListContext || "No tasks created yet."}\n\nUser Request: ${request}`;

      const parsed = await generationService.generateJson(
        systemPrompt,
        userContext,
        { tasks: [] },
        provider,
      );

      const drafts = (parsed?.tasks || []).map((t, i) =>
        normalizeGeneratedTask(
          {
            ...t,
            workstream: "Recommended",
          },
          i,
        ),
      );

      return res.json({
        drafts,
        requires_confirmation: true,
        message:
          parsed?.message ||
          "Based on the project state, here are my recommendations for you:",
      });
    }

    const fallbackDraft = {
      title: request.replace(/\s+/g, " ").trim().substring(0, 80),
      priority: "medium",
      assignee_name: null,
    };

    const systemPrompt = `You are the CollabAgent Task Management AI. 
Extract the following details from the user's request: title, priority (low, medium, high, urgent), and assignee_name (if mentioned).
If the user says "assign it to me", "for me", "assign me", or any similar self-assignment phrase, set assignee_name to "me".
Respond strictly with valid JSON.
Format: { "title": "string", "priority": "string", "assignee_name": "string or null" }`;

    const parsedDraft = await generationService.generateJson(
      systemPrompt,
      request,
      fallbackDraft,
      provider,
    );
    const draft = normalizeSingleTaskDraft(parsedDraft, request);

    // If the user explicitly asked to be assigned ("assign it to me", "for me", etc.)
    // but the LLM didn't extract an assignee, default to "me" so resolveAssigneeId
    // can map it to the current user in the /confirm step.
    if (detectSelfAssignment(request) && !draft.assignee_name) {
      draft.assignee_name = "me";
    }

    // Return the draft to the user for confirmation (no DB write yet)
    res.json({
      draft,
      requires_confirmation: true,
      message: "Please review and confirm this task draft before creation.",
    });
  } catch (err) {
    console.error("[TaskAgent] Parse error:", err);
    res.status(500).json({ error: "Failed to parse task request" });
  }
});

// POST /api/agents/task/confirm - Commit task to DB (Requires user_confirmed: true)
router.post(
  "/confirm",
  authenticate,
  requireStudentAgent,
  agentGate,
  async (req, res) => {
    try {
      const { draft, projectId } = req.body;

      if (!draft || !draft.title || !projectId) {
        return res
          .status(400)
          .json({ error: "Valid draft and projectId required" });
      }

      if (!(await canStudentWorkOnProject(req.user, projectId))) {
        return res
          .status(403)
          .json({ error: "Only assigned students can create tasks" });
      }
      if (await isProjectArchived(projectId)) {
        return res
          .status(403)
          .json({ error: "Archived projects are read-only." });
      }

      const assignedTo = await resolveAssigneeId(
        draft.assignee_name,
        projectId,
        req.user,
      );
      const metadata = draft.metadata || {};
      const duplicateParams = [
        projectId,
        draft.title,
        assignedTo,
        metadata.source,
        metadata.order !== undefined && metadata.order !== null
          ? String(metadata.order)
          : null,
      ];
      const duplicateMetadataFilter = buildDuplicateTaskMetadataFilter(
        metadata,
        4,
      );

      if (duplicateMetadataFilter) {
        const duplicate = await pool.query(
          `SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.project_id = $1
           AND LOWER(TRIM(t.title)) = LOWER(TRIM($2))
           AND t.status <> 'done'
           AND t.assigned_to IS NOT DISTINCT FROM $3
           ${duplicateMetadataFilter}
         ORDER BY t.created_at DESC
         LIMIT 1`,
          duplicateParams,
        );

        if (duplicate.rows.length) {
          return res.status(200).json({
            task: duplicate.rows[0],
            duplicate: true,
            message: "Task already exists for this draft.",
          });
        }
      }

      // Check for an existing task with the SAME TITLE that is UNASSIGNED.
      // If found, we update that one instead of creating a new one.
      const existingUnassigned = await pool.query(
        `SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.project_id = $1 AND LOWER(TRIM(t.title)) = LOWER(TRIM($2))
         AND t.assigned_to IS NULL AND t.status <> 'done'
         LIMIT 1`,
        [projectId, draft.title],
      );

      if (existingUnassigned.rows.length && assignedTo) {
        const updateResult = await pool.query(
          `UPDATE tasks SET assigned_to = $1 WHERE id = $2 RETURNING *`,
          [assignedTo, existingUnassigned.rows[0].id],
        );

        const updatedTask = updateResult.rows[0];

        await recordProjectEvent({
          projectId,
          actorId: req.user.id,
          eventType: "task.assigned",
          entityType: "task",
          entityId: updatedTask.id,
          metadata: {
            title: updatedTask.title,
            priority: updatedTask.priority,
            assignedTo: updatedTask.assigned_to,
          },
        });

        return res.status(200).json({
          task: {
            ...updatedTask,
            assignee_name: req.user.full_name,
            assignee_avatar: req.user.avatar_url,
          },
          message: "Task assigned to you.",
        });
      }

      const duplicateByTitle = await pool.query(
        `SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.project_id = $1
           AND LOWER(TRIM(t.title)) = LOWER(TRIM($2))
           AND t.status <> 'done'
           AND t.assigned_to IS NOT DISTINCT FROM $3
         ORDER BY t.created_at DESC
         LIMIT 1`,
        [projectId, draft.title, assignedTo],
      );

      if (duplicateByTitle.rows.length) {
        return res.status(200).json({
          task: duplicateByTitle.rows[0],
          duplicate: true,
          message: "Task already exists for this draft.",
        });
      }

      // Write to database using the same task schema as the primary task API.
      const result = await pool.query(
        `INSERT INTO tasks
        (project_id, title, description, status, priority, assigned_to, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
        [
          projectId,
          draft.title,
          draft.description || "",
          draft.status || "todo",
          normalizePriority(draft.priority),
          assignedTo,
          metadata,
          req.user.id,
        ],
      );

      const newTask = result.rows[0];

      const full = await pool.query(
        `
      SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1
    `,
        [newTask.id],
      );

      // Emit event to broker so Team Coordination Agent can log it
      eventBroker.publish("task.assigned", {
        taskId: newTask.id,
        projectId,
        title: newTask.title,
        priority: newTask.priority,
        assignedTo: newTask.assigned_to,
      });

      await recordProjectEvent({
        projectId,
        actorId: req.user.id,
        eventType: "task.assigned",
        entityType: "task",
        entityId: newTask.id,
        metadata: {
          title: newTask.title,
          priority: newTask.priority,
          assignedTo: newTask.assigned_to,
        },
        notification: newTask.assigned_to
          ? {
              recipientIds: [newTask.assigned_to],
              skipActor: false,
              type: "task.assigned",
              category: "mentions",
              title: `Task assigned: ${newTask.title}`,
              body: `${req.user.full_name} assigned you a ${newTask.priority} priority task.`,
              link: `/projects/${projectId}/tasks`,
            }
          : null,
      });

      res.status(201).json({ task: full.rows[0] });
    } catch (err) {
      console.error("[TaskAgent] Confirm error:", err);
      res.status(500).json({ error: "Failed to confirm and create task" });
    }
  },
);

// POST /api/agents/task/update-existing - Draft an update for an existing todo task
router.post(
  "/update-existing",
  authenticate,
  requireStudentAgent,
  async (req, res) => {
    try {
      const { request, projectId, provider = null } = req.body;

      if (!request || !projectId) {
        return res
          .status(400)
          .json({ error: "Request text and projectId are required" });
      }
      if (!(await canStudentWorkOnProject(req.user, projectId))) {
        return res
          .status(403)
          .json({ error: "Only assigned students can update tasks" });
      }

      const todoTasks = await getProjectTodoTasks(projectId);
      if (!todoTasks.length) {
        return res
          .status(404)
          .json({ error: "No todo tasks found for this project." });
      }

      const fallbackDraft = {
        task_title: extractQuotedTaskTitle(request) || null,
        assignee_name: /\b(me|myself|self)\b/i.test(request) ? "me" : null,
        deadline: parseInlineDeadline(request),
      };

      const taskList = todoTasks
        .map(
          (task) => `- ${task.title} (${task.assignee_name || "Unassigned"})`,
        )
        .join("\n");
      const systemPrompt = `You are the CollabAgent Task Update AI.
The user wants to update one existing todo task. Choose exactly one task from the provided task list and extract assignment/deadline changes.
Return strictly valid JSON with:
{
  "task_title": "exact task title from the list",
  "assignee_name": "teammate full name, email, me, or null",
  "deadline": "YYYY-MM-DD or null"
}
If the user did not request an assignee or deadline, use null for that field.`;

      const parsed = await generationService.generateJson(
        systemPrompt,
        `Todo tasks:\n${taskList}\n\nUser request:\n${request}`,
        fallbackDraft,
        provider,
      );
      const requestedTitle = parsed?.task_title || fallbackDraft.task_title;
      const task =
        findBestTaskMatch(todoTasks, requestedTitle) ||
        findImplicitTaskMatch(todoTasks, request, req.user);

      if (!task) {
        return res.status(404).json({
          error: "Could not match the request to an existing todo task.",
        });
      }

      const assigneeName = parsed?.assignee_name || fallbackDraft.assignee_name;
      const deadline = parsed?.deadline || fallbackDraft.deadline || null;
      const assignedTo = assigneeName
        ? await resolveAssigneeId(assigneeName, projectId, req.user)
        : undefined;

      if (assigneeName && !assignedTo) {
        return res
          .status(404)
          .json({ error: `Could not find project member "${assigneeName}".` });
      }
      if (!assignedTo && !deadline) {
        return res.status(400).json({
          error: "No assignee or deadline change was found in the request.",
        });
      }

      const assigneeDisplay = assignedTo
        ? assigneeName === "me"
          ? req.user.full_name
          : assigneeName
        : task.assignee_name || null;

      res.json({
        updateDraft: {
          taskId: task.id,
          title: task.title,
          currentAssigneeName: task.assignee_name,
          currentDeadline: task.deadline,
          assignee_name: assigneeDisplay,
          assigned_to: assignedTo || null,
          deadline,
        },
        requires_confirmation: true,
        message: "Please review and confirm this existing task update.",
      });
    } catch (err) {
      console.error("[TaskAgent] Existing task update parse error:", err);
      res.status(500).json({ error: "Failed to prepare existing task update" });
    }
  },
);

// POST /api/agents/task/update-existing/confirm - Apply an update to an existing todo task
router.post(
  "/update-existing/confirm",
  authenticate,
  requireStudentAgent,
  agentGate,
  async (req, res) => {
    try {
      const { updateDraft, projectId } = req.body;

      if (!updateDraft?.taskId || !projectId) {
        return res
          .status(400)
          .json({ error: "Valid updateDraft and projectId are required" });
      }
      if (!(await canStudentWorkOnProject(req.user, projectId))) {
        return res
          .status(403)
          .json({ error: "Only assigned students can update tasks" });
      }
      if (await isProjectArchived(projectId)) {
        return res
          .status(403)
          .json({ error: "Archived projects are read-only." });
      }

      const fields = [];
      const params = [];

      if (updateDraft.assigned_to !== undefined) {
        params.push(updateDraft.assigned_to);
        fields.push(`assigned_to = $${params.length}`);
      }
      if (updateDraft.deadline !== undefined) {
        params.push(updateDraft.deadline);
        fields.push(`deadline = $${params.length}`);
      }

      if (!fields.length) {
        return res
          .status(400)
          .json({ error: "No supported task updates were provided." });
      }

      params.push(updateDraft.taskId, projectId);
      const result = await pool.query(
        `UPDATE tasks
       SET ${fields.join(", ")}
       WHERE id = $${params.length - 1}
         AND project_id = $${params.length}
         AND status = 'todo'
       RETURNING *`,
        params,
      );

      if (!result.rows.length) {
        return res
          .status(404)
          .json({ error: "Todo task not found or no longer editable." });
      }

      const full = await pool.query(
        `
      SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1
    `,
        [updateDraft.taskId],
      );

      eventBroker.publish("task.updated", {
        taskId: updateDraft.taskId,
        projectId,
        title: result.rows[0].title,
        assignedTo: result.rows[0].assigned_to,
        deadline: result.rows[0].deadline,
      });

      await recordProjectEvent({
        projectId,
        actorId: req.user.id,
        eventType: "task.updated",
        entityType: "task",
        entityId: updateDraft.taskId,
        metadata: {
          title: result.rows[0].title,
          assignedTo: result.rows[0].assigned_to,
          deadline: result.rows[0].deadline,
        },
        notification: result.rows[0].assigned_to
          ? {
              recipientIds: [result.rows[0].assigned_to],
              skipActor: false,
              type: "task.updated",
              category: "mentions",
              title: `Task assigned: ${result.rows[0].title}`,
              body: `${req.user.full_name} updated your task assignment.`,
              link: `/projects/${projectId}/tasks`,
            }
          : null,
      });

      res.json({ task: full.rows[0] });
    } catch (err) {
      console.error("[TaskAgent] Existing task update confirm error:", err);
      res.status(500).json({ error: "Failed to update existing task" });
    }
  },
);

// GET /api/agents/task/prioritized - Get tasks ranked by priority
router.get(
  "/prioritized",
  authenticate,
  requireStudentAgent,
  async (req, res) => {
    try {
      const { projectId } = req.query;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      if (!(await canStudentWorkOnProject(req.user, projectId))) {
        return res
          .status(404)
          .json({ error: "Project not found or unauthorized" });
      }

      // Simple priority sorting logic
      const result = await pool.query(
        `SELECT * FROM tasks 
       WHERE project_id = $1 
       ORDER BY 
         CASE priority 
           WHEN 'urgent' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
           ELSE 5 
         END, 
         created_at DESC`,
        [projectId],
      );

      res.json(result.rows);
    } catch (err) {
      console.error("[TaskAgent] Prioritized error:", err);
      res.status(500).json({ error: "Failed to fetch prioritized tasks" });
    }
  },
);

router._test = {
  buildDuplicateTaskMetadataFilter,
  extractKnowledgeReferenceTerms,
  looksLikeTaskBreakdownRequest,
  looksLikeRAGAugmentedTaskRequest,
  normalizeSingleTaskDraft,
  scoreKnowledgeDocument,
};

module.exports = router;
