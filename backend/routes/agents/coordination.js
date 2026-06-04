const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const { authenticate } = require("../../middleware/auth");
const eventBroker = require("../../services/eventBroker");
const generationService = require("../../services/generationService");
const {
  canReadProject,
  canStudentWorkOnProject,
  canWriteProject,
} = require("../../services/projectAccess");

function normalizePriority(priority) {
  const normalized = String(priority || "medium").toLowerCase();
  if (normalized === "urgent") return "critical";
  return ["low", "medium", "high", "critical"].includes(normalized)
    ? normalized
    : "medium";
}

function requireStudentAgent(req, res, next) {
  if (req.user?.role !== "student") {
    return res
      .status(403)
      .json({ error: "Team Coordinator is available to students only." });
  }
  next();
}

// POST /api/agents/coordination/meeting - Summarize meeting and extract tasks
router.post("/meeting", authenticate, requireStudentAgent, async (req, res) => {
  try {
    const { transcript, projectId, provider = null } = req.body;

    if (!transcript || !projectId) {
      return res
        .status(400)
        .json({ error: "Transcript and projectId are required" });
    }
    if (!(await canStudentWorkOnProject(req.user, projectId))) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized" });
    }

    const fallbackResult = {
      summary: "Fallback summary: " + transcript.substring(0, 100) + "...",
      action_items: [
        {
          title: "Review meeting notes",
          priority: "medium",
          assignee_name: null,
        },
      ],
    };

    const systemPrompt = `You are the CollabAgent Team Coordination AI.
Review the following meeting transcript.
Produce a response strictly in valid JSON format containing:
1. "summary": A brief 2-3 sentence summary of the meeting.
2. "action_items": An array of objects, each with:
   - "title": Action item description
   - "priority": low, medium, high, or urgent
   - "assignee_name": Name of the assignee if mentioned, otherwise null.

Format strictly as JSON.`;

    const parsed = await generationService.generateJson(
      systemPrompt,
      `Transcript:\n${transcript}`,
      fallbackResult,
      provider,
    );
    const summary = parsed.summary || fallbackResult.summary;
    const actionItemDrafts = (
      Array.isArray(parsed.action_items)
        ? parsed.action_items
        : fallbackResult.action_items
    ).map((item, index) => ({
      ...item,
      priority: normalizePriority(item.priority),
      metadata: {
        ...(item.metadata || {}),
        source: "team_coordinator_action_item",
        order: index + 1,
      },
    }));

    // Log the meeting event
    await pool.query(
      `INSERT INTO activity_log (project_id, actor_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)`,
      [projectId, req.user.id, "meeting.logged", { summary }],
    );

    res.json({
      summary,
      actionItemDrafts,
      requires_confirmation: true,
      message:
        "Action items extracted. Please pass them to the Task Management Agent to confirm.",
    });
  } catch (err) {
    console.error("[CoordinationAgent] Meeting parse error:", err);
    res.status(500).json({ error: "Failed to parse meeting transcript" });
  }
});

// GET /api/agents/coordination/activity - Get team activity feed
router.get("/activity", authenticate, async (req, res) => {
  try {
    const { projectId, before, limit: rawLimit } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    if (!(await canReadProject(req.user, projectId))) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized" });
    }

    const pageSize = Math.min(Math.max(parseInt(rawLimit, 10) || 50, 1), 200);
    const params = [projectId];
    let cursorClause = "";

    if (before) {
      params.push(before);
      cursorClause = `AND a.created_at < $${params.length}`;
    }

    const result = await pool.query(
      `SELECT a.*, u.full_name as actor_name 
       FROM activity_log a
       LEFT JOIN users u ON a.actor_id = u.id
       WHERE a.project_id = $1 ${cursorClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, pageSize + 1],
    );

    const hasMore = result.rows.length > pageSize;
    const logs = hasMore ? result.rows.slice(0, pageSize) : result.rows;

    res.json({ logs, hasMore });
  } catch (err) {
    console.error("[CoordinationAgent] Activity fetch error:", err);
    res.status(500).json({ error: "Failed to fetch activity log" });
  }
});

// POST /api/agents/coordination/activity - Log AI workbench activity
router.post("/activity", authenticate, async (req, res) => {
  try {
    const {
      projectId,
      actionType,
      status = "success",
      timestamp,
      metadata = {},
    } = req.body;

    if (!projectId || !actionType) {
      return res
        .status(400)
        .json({ error: "projectId and actionType are required" });
    }
    if (!(await canWriteProject(req.user, projectId))) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized" });
    }

    const eventType = `ai_workbench.${String(actionType)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")}`;
    const result = await pool.query(
      `INSERT INTO activity_log (project_id, actor_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        projectId,
        req.user.id,
        eventType,
        {
          ...metadata,
          timestamp: timestamp || new Date().toISOString(),
          userId: req.user.id,
          role: req.user.role,
          actionType,
          status,
        },
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[CoordinationAgent] Activity log error:", err);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

// Register Event Consumers to log cross-agent activity
eventBroker.subscribe("task.assigned", "CoordinationAgent", async (payload) => {
  try {
    await pool.query(
      `INSERT INTO activity_log (project_id, actor_id, event_type, metadata)
       VALUES ($1, NULL, $2, $3)`,
      [
        payload.projectId,
        "task.assigned",
        { taskId: payload.taskId, title: payload.title },
      ],
    );
  } catch (err) {
    console.error("[CoordinationAgent] Failed to log task.assigned:", err);
  }
});

eventBroker.subscribe(
  "document.indexed",
  "CoordinationAgent",
  async (payload) => {
    try {
      await pool.query(
        `INSERT INTO activity_log (project_id, actor_id, event_type, metadata)
       VALUES ($1, NULL, $2, $3)`,
        [
          payload.projectId,
          "document.indexed",
          {
            documentId: payload.documentId,
            title: payload.title,
            chunks: payload.chunkCount,
          },
        ],
      );
    } catch (err) {
      console.error("[CoordinationAgent] Failed to log document.indexed:", err);
    }
  },
);

module.exports = router;
