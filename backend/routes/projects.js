const express = require("express");
const router = express.Router();
const { body, query, validationResult } = require("express-validator");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");
const { recordProjectEvent } = require("../services/notificationService");
const { canReadProject } = require("../services/projectAccess");

// All project routes require auth
router.use(authenticate);

const QUARTERS = ["Fall", "Winter", "Spring", "Summer"];
const PROJECT_STATUSES = ["active", "completed", "archived", "paused"];

function isAdvisor(req) {
  return req.user.role === "advisor";
}

function requireAdvisor(req, res) {
  if (!isAdvisor(req)) {
    res.status(403).json({ error: "Advisor permissions required" });
    return false;
  }
  return true;
}

const projectValidators = [
  body("status").optional().isIn(PROJECT_STATUSES),
  body("quarter").optional({ nullable: true, checkFalsy: true }).isIn(QUARTERS),
  body("visibility").optional().isIn(["public", "private", "institution"]),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Project name required"),
  body("advisor_name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Advisor name required"),
];

async function updateProject(req, res) {
  if (!requireAdvisor(req, res)) return;

  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { name, description, advisor_name, status, visibility, tags, quarter } =
    req.body;
  try {
    const result = await pool.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        advisor_name = COALESCE($3, advisor_name),
        status = COALESCE($4, status),
        visibility = COALESCE($5, visibility),
        tags = COALESCE($6, tags),
        quarter = COALESCE($7, quarter)
       WHERE id = $8 AND owner_id = $9
       RETURNING *`,
      [
        name,
        description,
        advisor_name,
        status,
        visibility,
        tags,
        quarter || null,
        req.params.id,
        req.user.id,
      ],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized" });
    await recordProjectEvent({
      projectId: result.rows[0].id,
      actorId: req.user.id,
      eventType: "project.updated",
      entityType: "project",
      entityId: result.rows[0].id,
      metadata: {
        name: result.rows[0].name,
        status: result.rows[0].status,
        visibility: result.rows[0].visibility,
      },
      notification: {
        type: "project.updated",
        category: status === "archived" ? "system" : "updates",
        title: `${result.rows[0].name} was updated`,
        body: status
          ? `Project status changed to ${result.rows[0].status}.`
          : "Project details were updated.",
        actionUrl: `/projects/${result.rows[0].id}`,
      },
    });
    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/projects - list user's projects
router.get(
  "/",
  [
    query("status").optional().isIn(PROJECT_STATUSES),
    query("quarter").optional().isIn(QUARTERS),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const params = [req.user.id];
      let filters = "";
      if (req.query.status) {
        params.push(req.query.status);
        filters += ` AND p.status = $${params.length}`;
      }
      if (req.query.quarter) {
        params.push(req.query.quarter);
        filters += ` AND p.quarter = $${params.length}`;
      }

      const result = await pool.query(
        `SELECT p.*, u.full_name as owner_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) as doc_count,
        (SELECT COUNT(*) FROM agents a WHERE a.project_id = p.id) as agent_count
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE (
         p.owner_id = $1
         OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)
       )
       ${filters}
       ORDER BY p.updated_at DESC`,
        params,
      );
      res.json({ projects: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/projects/:id/timeline - timeline-ready tasks and dependencies
router.get(
  "/:id/timeline",
  [
    query("workstream").optional().trim().notEmpty(),
    query("tag").optional().trim().notEmpty(),
    query("assignee").optional().isUUID(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { workstream, tag, assignee } = req.query;

    try {
      if (!(await canReadProject(req.user, req.params.id))) {
        return res
          .status(404)
          .json({ error: "Project not found or unauthorized" });
      }

      const params = [req.params.id];
      let filters = "";

      if (workstream) {
        params.push(workstream);
        filters += `
          AND COALESCE(
            NULLIF(t.metadata->>'workstream', ''),
            CASE WHEN array_length(t.tags, 1) > 0 THEN t.tags[1] ELSE 'General' END
          ) = $${params.length}`;
      }

      if (tag) {
        params.push(tag);
        filters += ` AND t.tags @> ARRAY[$${params.length}]::text[]`;
      }

      if (assignee) {
        params.push(assignee);
        filters += ` AND t.assigned_to = $${params.length}`;
      }

      const tasksResult = await pool.query(
        `SELECT
           t.id,
           t.project_id,
           t.title AS name,
           t.title,
           t.status,
           t.priority,
           t.assigned_to,
           u.full_name AS assignee_name,
           u.avatar_url AS assignee_avatar,
           t.deadline,
           t.estimated_hours,
           t.tags,
           COALESCE(
             NULLIF(t.metadata->>'workstream', ''),
             CASE WHEN array_length(t.tags, 1) > 0 THEN t.tags[1] ELSE 'General' END
           ) AS workstream,
           COALESCE(
             CASE
               WHEN NULLIF(t.metadata->>'start_date', '') ~ '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}'
                 THEN (t.metadata->>'start_date')::timestamptz
               WHEN NULLIF(t.metadata->>'start_date', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
                 THEN (SUBSTRING(t.metadata->>'start_date', 1, 10) || 'T00:00:00Z')::timestamptz
               ELSE NULL
             END,
             CASE
               WHEN t.deadline IS NOT NULL THEN
                 t.deadline - make_interval(days => GREATEST(1, CEIL(COALESCE(t.estimated_hours, 8) / 8.0)::int))
               ELSE t.created_at
             END
           ) AS start_date,
           t.created_at,
           t.updated_at
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.project_id = $1
         ${filters}
         ORDER BY workstream ASC, start_date ASC, t.deadline ASC NULLS LAST, t.created_at ASC`,
        params,
      );

      const taskIds = tasksResult.rows.map((task) => task.id);
      const dependenciesResult = taskIds.length
        ? await pool.query(
            `SELECT
             td.parent_task_id AS source,
             td.child_task_id AS target,
             td.dep_type AS type
           FROM task_dependencies td
           WHERE td.parent_task_id = ANY($1::uuid[])
             AND td.child_task_id = ANY($1::uuid[])
           ORDER BY td.created_at ASC`,
            [taskIds],
          )
        : { rows: [] };

      const metaResult = await pool.query(
        `SELECT
           COALESCE(
             NULLIF(t.metadata->>'workstream', ''),
             CASE WHEN array_length(t.tags, 1) > 0 THEN t.tags[1] ELSE 'General' END
           ) AS workstream,
           tag.value AS tag
         FROM tasks t
         LEFT JOIN LATERAL unnest(t.tags) AS tag(value) ON TRUE
         WHERE t.project_id = $1`,
        [req.params.id],
      );

      const membersResult = await pool.query(
        `SELECT u.id, u.full_name, u.avatar_url, pm.member_role
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = $1
         ORDER BY u.full_name ASC`,
        [req.params.id],
      );

      const workstreams = new Set();
      const tags = new Set();
      for (const row of metaResult.rows) {
        if (row.workstream) workstreams.add(row.workstream);
        if (row.tag) tags.add(row.tag);
      }

      const now = new Date();
      const byId = new Map(tasksResult.rows.map((task) => [task.id, task]));
      const conflicts = [];

      for (const task of tasksResult.rows) {
        if (
          task.deadline &&
          task.status !== "done" &&
          new Date(task.deadline) < now
        ) {
          conflicts.push({
            type: "overdue",
            task_id: task.id,
            severity: "warning",
            message: `${task.name} is overdue.`,
          });
        }
      }

      for (const dep of dependenciesResult.rows) {
        const source = byId.get(dep.source);
        const target = byId.get(dep.target);
        if (
          source?.deadline &&
          target?.deadline &&
          new Date(target.deadline) < new Date(source.deadline)
        ) {
          conflicts.push({
            type: "dependency_order",
            task_id: target.id,
            dependency_id: source.id,
            severity: "critical",
            message: `${target.name} is due before dependency ${source.name}.`,
          });
        }
      }

      res.json({
        tasks: tasksResult.rows.map((task) => ({
          ...task,
          dependencies: dependenciesResult.rows
            .filter((dep) => dep.target === task.id)
            .map((dep) => dep.source),
          completion_status: task.status,
        })),
        dependencies: dependenciesResult.rows,
        conflicts,
        filters: {
          workstreams: Array.from(workstreams).sort(),
          tags: Array.from(tags).sort(),
          assignees: membersResult.rows,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/projects - create project
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Project name required"),
    ...projectValidators,
  ],
  async (req, res) => {
    if (!requireAdvisor(req, res)) return;

    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const {
      name,
      description,
      advisor_name,
      visibility = "private",
      tags,
      quarter,
    } = req.body;
    const finalAdvisorName = advisor_name || req.user.full_name;
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO projects (name, description, advisor_name, owner_id, visibility, tags, quarter)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          name,
          description,
          finalAdvisorName,
          req.user.id,
          visibility,
          tags || [],
          quarter || null,
        ],
      );
      // Auto-add owner as member
      await client.query(
        `INSERT INTO project_members (project_id, user_id, member_role)
         VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
        [result.rows[0].id, req.user.id],
      );
      await recordProjectEvent({
        projectId: result.rows[0].id,
        actorId: req.user.id,
        eventType: "project.created",
        entityType: "project",
        entityId: result.rows[0].id,
        metadata: {
          name: result.rows[0].name,
          quarter: result.rows[0].quarter,
        },
      }, client);
      await client.query("COMMIT");
      res.status(201).json({ project: result.rows[0] });
    } catch (err) {
      if (client) await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      if (client) client.release();
    }
  },
);

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  try {
    if (!(await canReadProject(req.user, req.params.id))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const result = await pool.query(
      `SELECT p.*, u.full_name as owner_name FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Project not found" });

    const project = result.rows[0];

    // Fetch members
    const membersResult = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, pm.member_role
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1`,
      [req.params.id],
    );
    project.members = membersResult.rows;

    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/projects/:id
router.put("/:id", projectValidators, updateProject);

// PATCH /api/projects/:id
router.patch("/:id", projectValidators, updateProject);

// POST /api/projects/:id/members - advisor owner assigns a student by email
router.post(
  "/:id/members",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid student email required"),
    body("member_role").optional().isIn(["member", "viewer"]),
  ],
  async (req, res) => {
    if (!requireAdvisor(req, res)) return;

    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, member_role = "member" } = req.body;
    try {
      const project = await pool.query(
        "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
        [req.params.id, req.user.id],
      );
      if (project.rows.length === 0)
        return res
          .status(404)
          .json({ error: "Project not found or unauthorized" });

      const student = await pool.query(
        `SELECT id, full_name, email, avatar_url, role
         FROM users
         WHERE email = $1`,
        [email],
      );
      if (student.rows.length === 0)
        return res.status(404).json({ error: "Student account not found" });
      if (student.rows[0].role !== "student")
        return res
          .status(400)
          .json({ error: "Only student users can be assigned to projects" });

      await pool.query(
        `INSERT INTO project_members (project_id, user_id, member_role)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id)
         DO UPDATE SET member_role = EXCLUDED.member_role`,
        [req.params.id, student.rows[0].id, member_role],
      );

      await recordProjectEvent({
        projectId: req.params.id,
        actorId: req.user.id,
        eventType: "project.member_added",
        entityType: "user",
        entityId: student.rows[0].id,
        metadata: {
          memberRole: member_role,
          memberName: student.rows[0].full_name,
          memberEmail: student.rows[0].email,
        },
        notification: {
          recipientIds: [student.rows[0].id],
          skipActor: false,
          type: "project.assignment",
          category: "mentions",
          title: `You were added to a project`,
          body: `${req.user.full_name} added you as ${member_role}.`,
          actionUrl: `/projects/${req.params.id}`,
        },
      });

      res.status(201).json({
        member: {
          id: student.rows[0].id,
          full_name: student.rows[0].full_name,
          email: student.rows[0].email,
          avatar_url: student.rows[0].avatar_url,
          member_role,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// DELETE /api/projects/:id
router.delete("/:id", async (req, res) => {
  if (!requireAdvisor(req, res)) return;

  try {
    const result = await pool.query(
      "DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING id",
      [req.params.id, req.user.id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized" });
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
