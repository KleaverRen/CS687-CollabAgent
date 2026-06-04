const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");
const { canReadProject } = require("../services/projectAccess");

router.use(authenticate);

function buildDependentCountMap(edges) {
  const counts = new Map();
  for (const edge of edges) {
    counts.set(edge.parent_task_id, (counts.get(edge.parent_task_id) || 0) + 1);
  }
  return counts;
}

// ═══════════════════════════════════════════════════════════
//  ALGORITHM 1 — Blocker Detection
//  Finds tasks that are blocked AND their blocking dependency
//  is not yet done, ordered by downstream dependent count.
// ═══════════════════════════════════════════════════════════
function detectBlockers(tasks, edges) {
  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const dependentCounts = buildDependentCountMap(edges);
  const suggestions = [];

  for (const edge of edges) {
    if (edge.dep_type !== "blocks") continue;
    const parent = taskMap[edge.parent_task_id];
    const child = taskMap[edge.child_task_id];
    if (!parent || !child) continue;

    const parentNotDone = parent.status !== "done";
    const childBlocked =
      child.status === "blocked" || child.status === "in_progress";
    if (!parentNotDone || !childBlocked) continue;

    // If the blocking task is already in progress, don't suggest moving it there again
    if (parent.status === "in_progress") continue;

    // Count how many tasks this blocker cascades to
    const cascadeCount = dependentCounts.get(edge.child_task_id) || 0;

    const daysUntilDeadline = child.deadline
      ? Math.ceil((new Date(child.deadline) - new Date()) / 86400000)
      : null;

    const severity =
      cascadeCount >= 3 ||
      (daysUntilDeadline !== null && daysUntilDeadline <= 2)
        ? "critical"
        : cascadeCount >= 1 ||
            (daysUntilDeadline !== null && daysUntilDeadline <= 7)
          ? "warning"
          : "info";

    suggestions.push({
      type: "blocker",
      severity,
      task_id: child.id,
      task_title: child.title,
      blocking_task_id: parent.id,
      blocking_task_title: parent.title,
      cascade_count: cascadeCount,
      days_until_deadline: daysUntilDeadline,
      title: `"${parent.title}" is blocking ${cascadeCount + 1} task(s)`,
      description: `"${child.title}" cannot progress until "${parent.title}" is marked done.${
        cascadeCount > 0
          ? ` This also cascades to ${cascadeCount} downstream task(s).`
          : ""
      }${daysUntilDeadline !== null ? ` Deadline in ${daysUntilDeadline} day(s).` : ""}`,
      action_label: "Mark blocker as In Progress",
      action: { patch_task_id: parent.id, status: "in_progress" },
      confidence: Math.min(
        0.99,
        0.6 + cascadeCount * 0.1 + (severity === "critical" ? 0.2 : 0),
      ),
      confidence_formula: "base(0.6) + cascade_count×0.1 + critical_bonus(0.2)",
    });
  }

  return suggestions;
}

// ═══════════════════════════════════════════════════════════
//  ALGORITHM 2 — Task Split Recommender
//  Flags tasks where estimated_hours > 8 OR dependent_count > 2
//  and suggests a decomposition template based on tags.
// ═══════════════════════════════════════════════════════════
const SPLIT_TEMPLATES = {
  design: ["Discovery & Requirements", "Wireframing", "Review & Sign-off"],
  api: ["Endpoint Design", "Implementation", "Testing & Documentation"],
  research: ["Literature Review", "Experiment Setup", "Analysis & Write-up"],
  testing: ["Test Plan", "Test Execution", "Bug Triage & Reporting"],
  default: ["Planning", "Implementation", "Review"],
};

function recommendSplits(tasks, edges) {
  const suggestions = [];
  const dependentCounts = buildDependentCountMap(edges);
  for (const task of tasks) {
    if (task.status === "done") continue;
    const hours = parseFloat(task.estimated_hours) || 0;
    const dependents = dependentCounts.get(task.id) || 0;

    if (hours < 8 && dependents < 2) continue;

    const tags = (task.tags || []).map((t) => t.toLowerCase());
    let templateKey = "default";
    for (const key of Object.keys(SPLIT_TEMPLATES)) {
      if (tags.some((t) => t.includes(key))) {
        templateKey = key;
        break;
      }
    }
    const parts = SPLIT_TEMPLATES[templateKey];

    const confidence = Math.min(
      0.95,
      (hours >= 16 ? 0.5 : hours >= 8 ? 0.35 : 0.1) +
        (dependents >= 3 ? 0.3 : dependents >= 2 ? 0.2 : 0),
    );

    suggestions.push({
      type: "split",
      severity: hours >= 16 || dependents >= 3 ? "warning" : "info",
      task_id: task.id,
      task_title: task.title,
      suggested_parts: parts,
      estimated_hours: hours,
      dependent_count: dependents,
      title: `Split "${task.title}" into ${parts.length} subtasks`,
      description: `This task has ${hours}h estimated${dependents > 0 ? ` and ${dependents} dependent task(s)` : ""}. Breaking it into "${parts.join('", "')}" reduces risk and improves parallelism.`,
      action_label: "Create subtasks",
      action: { create_subtasks: parts, parent_task_id: task.id },
      confidence,
      confidence_formula: `(hours≥16?0.5:hours≥8?0.35:0.1) + (dependents≥3?0.3:dependents≥2?0.2:0)`,
    });
  }
  return suggestions;
}

// ═══════════════════════════════════════════════════════════
//  ALGORITHM 3 — Critical Path Highlighter
//  Longest-path DP on dependency DAG.
//  Returns tasks on the critical path + delay propagation.
// ═══════════════════════════════════════════════════════════
function computeCriticalPath(tasks, edges) {
  const suggestions = [];
  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const childMap = {}; // parent → [children]
  const parentMap = {}; // child  → [parents]

  for (const t of tasks) {
    childMap[t.id] = [];
    parentMap[t.id] = [];
  }
  for (const e of edges) {
    if (!childMap[e.parent_task_id]) childMap[e.parent_task_id] = [];
    if (!parentMap[e.child_task_id]) parentMap[e.child_task_id] = [];
    childMap[e.parent_task_id].push(e.child_task_id);
    parentMap[e.child_task_id].push(e.parent_task_id);
  }

  // Topological sort (Kahn's)
  const inDegree = Object.fromEntries(
    tasks.map((t) => [t.id, parentMap[t.id]?.length || 0]),
  );
  const queue = tasks.filter((t) => inDegree[t.id] === 0).map((t) => t.id);
  const order = [];
  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    for (const child of childMap[cur] || []) {
      inDegree[child]--;
      if (inDegree[child] === 0) queue.push(child);
    }
  }

  // DP: dist[id] = max cumulative hours to reach this node
  const dist = Object.fromEntries(
    tasks.map((t) => [t.id, parseFloat(t.estimated_hours) || 1]),
  );
  const prev = {};
  for (const id of order) {
    for (const child of childMap[id] || []) {
      const newDist =
        dist[id] + (parseFloat(taskMap[child]?.estimated_hours) || 1);
      if (newDist > dist[child]) {
        dist[child] = newDist;
        prev[child] = id;
      }
    }
  }

  // Find the sink with highest dist (end of critical path)
  const sinks = tasks.filter((t) => (childMap[t.id] || []).length === 0);
  if (!sinks.length) return suggestions;

  const sink = sinks.reduce((a, b) => (dist[a.id] > dist[b.id] ? a : b));
  if (dist[sink.id] < 8) return suggestions; // Path too short to flag

  // Trace back
  const criticalPath = [];
  let cur = sink.id;
  while (cur) {
    criticalPath.unshift(cur);
    cur = prev[cur];
  }

  if (criticalPath.length < 2) return suggestions;

  const notDone = criticalPath.filter((id) => taskMap[id]?.status !== "done");
  if (!notDone.length) return suggestions;

  suggestions.push({
    type: "critical_path",
    severity: dist[sink.id] >= 24 ? "critical" : "warning",
    task_ids: criticalPath,
    critical_task_id: notDone[0],
    critical_task_title: taskMap[notDone[0]]?.title,
    total_hours: Math.round(dist[sink.id]),
    path_length: criticalPath.length,
    title: `Critical path spans ${Math.round(dist[sink.id])}h across ${criticalPath.length} tasks`,
    description: `The longest dependency chain runs ${criticalPath.length} tasks (${Math.round(dist[sink.id])}h total). Any delay in "${taskMap[notDone[0]]?.title}" propagates to all ${criticalPath.length - 1} downstream tasks.`,
    action_label: "Prioritize first blocking task",
    action: { patch_task_id: notDone[0], priority: "critical" },
    confidence: Math.min(0.98, 0.5 + criticalPath.length * 0.06),
    confidence_formula: "0.5 + path_length×0.06",
  });

  return suggestions;
}

// ═══════════════════════════════════════════════════════════
//  ALGORITHM 4 — Priority Re-ranker
//  Composite score: deadline proximity + blocker depth + dependents
// ═══════════════════════════════════════════════════════════
function reRankPriorities(tasks, edges) {
  const suggestions = [];
  const dependentCounts = buildDependentCountMap(edges);

  const scored = tasks
    .filter((t) => t.status !== "done")
    .map((t) => {
      const daysLeft = t.deadline
        ? Math.max(0, Math.ceil((new Date(t.deadline) - new Date()) / 86400000))
        : 999;
      const deadlineScore =
        daysLeft === 0 ? 10 : Math.max(0, 10 - daysLeft * 0.5);
      const dependentCount = dependentCounts.get(t.id) || 0;
      const score = deadlineScore + dependentCount * 2;

      const currentPriority = t.priority;
      const recommendedPriority =
        score >= 12
          ? "critical"
          : score >= 8
            ? "high"
            : score >= 4
              ? "medium"
              : "low";

      return { task: t, score, recommendedPriority, currentPriority };
    })
    .filter((s) => s.recommendedPriority !== s.currentPriority)
    .sort((a, b) => b.score - a.score);

  for (const s of scored) {
    suggestions.push({
      type: "priority_rerank",
      severity: s.recommendedPriority === "critical" ? "warning" : "info",
      task_id: s.task.id,
      task_title: s.task.title,
      current_priority: s.currentPriority,
      recommended_priority: s.recommendedPriority,
      score: Math.round(s.score),
      title: `Raise "${s.task.title}" to ${s.recommendedPriority}`,
      description: `Composite score: ${Math.round(s.score)} (deadline proximity + ${dependentCounts.get(s.task.id) || 0} dependents). Currently marked "${s.currentPriority}" — recommend upgrading to "${s.recommendedPriority}".`,
      action_label: `Set priority to ${s.recommendedPriority}`,
      action: { patch_task_id: s.task.id, priority: s.recommendedPriority },
      confidence: Math.min(0.9, 0.5 + s.score * 0.02),
      confidence_formula: "0.5 + composite_score×0.02",
    });
  }

  return suggestions;
}

// ═══════════════════════════════════════════════════════════
//  ALGORITHM 5 — Teammate Affinity Scorer
//  Scores team members by tag-completion overlap with a task.
// ═══════════════════════════════════════════════════════════
function scoreTeammates(task, members, allTasks) {
  const taskTags = new Set((task.tags || []).map((t) => t.toLowerCase()));

  return members
    .map((m) => {
      const doneTasks = allTasks.filter(
        (t) => t.assigned_to === m.id && t.status === "done",
      );
      const tagOverlap = doneTasks.filter((t) =>
        (t.tags || []).some((tag) => taskTags.has(tag.toLowerCase())),
      ).length;
      const match =
        doneTasks.length === 0
          ? 0.1
          : Math.min(0.99, 0.15 + (tagOverlap / doneTasks.length) * 0.84);

      return {
        user_id: m.id,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        match_pct: Math.round(match * 100),
        completed_tasks: doneTasks.length,
        tag_overlap: tagOverlap,
      };
    })
    .sort((a, b) => b.match_pct - a.match_pct)
    .slice(0, 3);
}

// ═══════════════════════════════════════════════════════════
//  POST /api/ai/suggest
//  Body: { project_id, task_id? }
// ═══════════════════════════════════════════════════════════
router.post("/suggest", [body("project_id").isUUID()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { project_id, task_id } = req.body;

  try {
    if (!(await canReadProject(req.user, project_id))) {
      return res.status(404).json({ error: "Project not found or unauthorized" });
    }

    const [tasksRes, edgesRes, membersRes] = await Promise.all([
      pool.query(
        `SELECT t.*, u.full_name AS assignee_name FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.project_id = $1`,
        [project_id],
      ),
      pool.query(
        `SELECT td.* FROM task_dependencies td
         JOIN tasks t ON td.parent_task_id = t.id
         WHERE t.project_id = $1`,
        [project_id],
      ),
      pool.query(
        `SELECT u.id, u.full_name, u.avatar_url FROM users u
         JOIN project_members pm ON u.id = pm.user_id
         WHERE pm.project_id = $1`,
        [project_id],
      ),
    ]);

    const tasks = tasksRes.rows;
    const edges = edgesRes.rows;
    const members = membersRes.rows;

    const suggestions = [
      ...detectBlockers(tasks, edges),
      ...recommendSplits(tasks, edges),
      ...computeCriticalPath(tasks, edges),
      ...reRankPriorities(tasks, edges),
    ];

    // Teammate suggestions for a specific task
    let affinitySuggestions = [];
    if (task_id) {
      const targetTask = tasks.find((t) => t.id === task_id);
      if (targetTask && members.length > 0) {
        const ranked = scoreTeammates(targetTask, members, tasks);
        if (ranked.length > 0) {
          affinitySuggestions = [
            {
              type: "teammate_affinity",
              severity: "info",
              task_id,
              task_title: targetTask.title,
              ranked_members: ranked,
              title: `Best assignee matches for "${targetTask.title}"`,
              description: `Based on tag-completion overlap across ${tasks.filter((t) => t.status === "done").length} completed tasks.`,
              action_label: `Assign to ${ranked[0]?.full_name}`,
              action: {
                patch_task_id: task_id,
                assigned_to: ranked[0]?.user_id,
              },
              confidence: ranked[0] ? ranked[0].match_pct / 100 : 0.1,
              confidence_formula:
                "tag_overlap / total_completed_tasks × 0.84 + 0.15",
            },
          ];
        }
      }
    }

    // Sort: critical → warning → info
    const severity_order = { critical: 0, warning: 1, info: 2 };
    const all = [...suggestions, ...affinitySuggestions].sort(
      (a, b) =>
        (severity_order[a.severity] ?? 2) - (severity_order[b.severity] ?? 2),
    );

    res.json({
      suggestions: all,
      meta: {
        task_count: tasks.length,
        edge_count: edges.length,
        member_count: members.length,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
