const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const generationService = require('../services/generationService');
const {
  canReadProject,
  canStudentWorkOnProject,
  isProjectMember,
} = require('../services/projectAccess');
const {
  clearDeadlineNotificationsForTask,
  recordProjectEvent,
} = require('../services/notificationService');

router.use(authenticate);

const ARCHIVED_PROJECT_ERROR = 'Archived projects are read-only.';

async function isProjectArchived(projectId) {
  const result = await pool.query('SELECT status FROM projects WHERE id = $1', [projectId]);
  return result.rows[0]?.status === 'archived';
}

async function getTaskProjectId(taskId) {
  const result = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0]?.project_id || null;
}

async function isTaskProjectArchived(taskId) {
  const result = await pool.query(
    `SELECT p.status
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1`,
    [taskId]
  );
  return result.rows[0]?.status === 'archived';
}

async function isDependencyProjectArchived(parentTaskId, childTaskId = null) {
  const params = [parentTaskId];
  let childFilter = '';
  if (childTaskId) {
    params.push(childTaskId);
    childFilter = ` OR t.id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS archived_count
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE (t.id = $1${childFilter}) AND p.status = 'archived'`,
    params
  );
  return result.rows[0]?.archived_count > 0;
}

function clampEstimatedHours(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(200, Math.round(parsed * 2) / 2);
}

function normalizeSuggestedPriority(value) {
  return ['low', 'medium', 'high', 'critical'].includes(value) ? value : 'medium';
}

function normalizeSuggestedDeadline(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeSuggestedAssignee(value, members) {
  if (!value) return null;
  const allowedIds = new Set(members.map((member) => member.id));
  return allowedIds.has(value) ? value : null;
}

function fallbackTaskSuggestions({ title, description, members }) {
  const text = `${title} ${description}`.toLowerCase();
  const priority = /\b(urgent|critical|blocker|security|production|deadline)\b/.test(text)
    ? 'critical'
    : /\b(api|backend|integration|database|migration|auth)\b/.test(text)
      ? 'high'
      : 'medium';

  const estimatedHours = /\b(simple|copy|text|minor|quick)\b/.test(text)
    ? 2
    : /\b(epic|migration|redesign|integration|dashboard)\b/.test(text)
      ? 12
      : 6;

  const deadline = new Date(Date.now() + (priority === 'critical' ? 2 : priority === 'high' ? 5 : 10) * 86400000)
    .toISOString()
    .slice(0, 10);

  return {
    priority,
    estimated_hours: estimatedHours,
    assigned_to: members[0]?.id || null,
    deadline,
    confidence: 0.35,
    rationale: 'Fallback estimate generated from task keywords because the AI provider did not return valid JSON.',
  };
}

function normalizeTaskSuggestionResult(raw, fallback, members) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    priority: normalizeSuggestedPriority(source.priority || fallback.priority),
    estimated_hours: clampEstimatedHours(source.estimated_hours ?? fallback.estimated_hours),
    assigned_to: normalizeSuggestedAssignee(source.assigned_to ?? fallback.assigned_to, members),
    deadline: normalizeSuggestedDeadline(source.deadline || fallback.deadline),
    confidence: Math.max(0, Math.min(1, Number.parseFloat(source.confidence ?? fallback.confidence) || fallback.confidence)),
    rationale: typeof source.rationale === 'string' && source.rationale.trim()
      ? source.rationale.trim().slice(0, 500)
      : fallback.rationale,
  };
}

// ─── GET /api/tasks?project_id=&status=&assignee= ─────────────────────────
router.get('/', [
  query('project_id').notEmpty().withMessage('project_id required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { project_id, status, assigned_to } = req.query;
  try {
    if (!(await canReadProject(req.user, project_id))) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    let q = `
      SELECT t.*,
        u.full_name  AS assignee_name,
        u.avatar_url AS assignee_avatar,
        cb.full_name AS creator_name,
        (SELECT COUNT(*) FROM task_dependencies td WHERE td.child_task_id = t.id)  AS blocker_count,
        (SELECT COUNT(*) FROM task_dependencies td WHERE td.parent_task_id = t.id) AS dependent_count
      FROM tasks t
      LEFT JOIN users u  ON t.assigned_to = u.id
      LEFT JOIN users cb ON t.created_by  = cb.id
      WHERE t.project_id = $1
    `;
    const params = [project_id];
    if (status)      { params.push(status);      q += ` AND t.status = $${params.length}`; }
    if (assigned_to) { params.push(assigned_to); q += ` AND t.assigned_to = $${params.length}`; }
    q += ' ORDER BY t.created_at DESC';

    const result = await pool.query(q, params);
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/tasks/suggest ──────────────────────────────────────────────
router.post('/suggest', [
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('project_id').optional().isUUID(),
  body('provider').optional().isIn(['groq', 'gemini', 'mistral', 'ollama']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const {
    title = '',
    description = '',
    project_id = null,
    provider = null,
  } = req.body;

  try {
    if (!title.trim() && !description.trim()) {
      return res.status(400).json({ error: 'Task title or description is required' });
    }

    let members = [];
    if (project_id) {
      if (!(await canReadProject(req.user, project_id))) {
        return res.status(404).json({ error: 'Project not found or unauthorized' });
      }

      const membersRes = await pool.query(
        `SELECT u.id, u.full_name, pm.member_role
         FROM users u
         JOIN project_members pm ON pm.user_id = u.id
         WHERE pm.project_id = $1
         ORDER BY u.full_name ASC`,
        [project_id]
      );
      members = membersRes.rows;
    }

    const fallback = fallbackTaskSuggestions({ title, description, members });
    const memberOptions = members.map((member) => ({
      id: member.id,
      full_name: member.full_name,
      role: member.member_role,
    }));

    const systemPrompt = [
      'You suggest editable task attributes for a project management app.',
      'Return ONLY valid JSON with this exact shape:',
      '{"priority":"low|medium|high|critical","estimated_hours":number,"assigned_to":"user id or null","deadline":"YYYY-MM-DD or null","confidence":number,"rationale":"short explanation"}',
      'Use only an assigned_to value from the provided team_members list. If no member fits, use null.',
      'Do not include markdown, prose, comments, or extra keys.',
    ].join('\n');

    const userPrompt = JSON.stringify({
      task: { title, description },
      today: new Date().toISOString().slice(0, 10),
      team_members: memberOptions,
    }, null, 2);

    const rawSuggestion = await generationService.generateJson(
      systemPrompt,
      userPrompt,
      fallback,
      provider,
    );

    const suggestion = normalizeTaskSuggestionResult(rawSuggestion, fallback, members);
    res.json({ suggestion, members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate task suggestions' });
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────
router.post('/', [
  body('project_id').isUUID(),
  body('title').trim().notEmpty(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('status').optional().isIn(['todo', 'in_progress', 'blocked', 'done']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const {
    project_id, title, description = '',
    status = 'todo', priority = 'medium',
    assigned_to = null, deadline = null,
    estimated_hours = null, tags = [],
  } = req.body;

  try {
    if (!(await canStudentWorkOnProject(req.user, project_id))) {
      return res.status(403).json({ error: 'Only assigned students can create tasks' });
    }
    if (await isProjectArchived(project_id)) {
      return res.status(403).json({ error: ARCHIVED_PROJECT_ERROR });
    }
    if (assigned_to && !(await isProjectMember(project_id, assigned_to))) {
      return res.status(400).json({ error: 'Assignee must be a project member' });
    }

    const result = await pool.query(`
      INSERT INTO tasks
        (project_id, title, description, status, priority,
         assigned_to, deadline, estimated_hours, tags, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [project_id, title, description, status, priority,
        assigned_to, deadline, estimated_hours, tags, req.user.id]);

    const task = result.rows[0];
    // Fetch with joined fields
    const full = await pool.query(`
      SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
      FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1
    `, [task.id]);

    const fullTask = full.rows[0];
    await recordProjectEvent({
      projectId: project_id,
      actorId: req.user.id,
      eventType: 'task.created',
      entityType: 'task',
      entityId: task.id,
      metadata: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assigned_to,
      },
      notification: task.assigned_to ? {
        recipientIds: [task.assigned_to],
        skipActor: false,
        type: 'task.assigned',
        category: 'mentions',
        title: `Task assigned: ${task.title}`,
        body: `${req.user.full_name} assigned you a ${task.priority} priority task.`,
        actionUrl: `/projects/${project_id}/tasks`,
      } : null,
    });

    res.status(201).json({ task: fullTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/tasks/graph/:project_id ────────────────────────────────────
router.get('/graph/:project_id', async (req, res) => {
  try {
    if (!(await canReadProject(req.user, req.params.project_id))) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    const tasks = await pool.query(
      `SELECT id, title, status, priority, deadline, estimated_hours FROM tasks WHERE project_id = $1`,
      [req.params.project_id]
    );
    const edges = await pool.query(`
      SELECT td.parent_task_id, td.child_task_id, td.dep_type
      FROM task_dependencies td
      JOIN tasks parent ON td.parent_task_id = parent.id
      JOIN tasks child ON td.child_task_id = child.id
      WHERE parent.project_id = $1
        AND child.project_id = $1
    `, [req.params.project_id]);

    res.json({ nodes: tasks.rows, edges: edges.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const projectId = await getTaskProjectId(req.params.id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    if (!(await canReadProject(req.user, projectId))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await pool.query(`
      SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar,
        cb.full_name AS creator_name
      FROM tasks t
      LEFT JOIN users u  ON t.assigned_to = u.id
      LEFT JOIN users cb ON t.created_by  = cb.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────
router.patch('/:id', [
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('status').optional().isIn(['todo', 'in_progress', 'blocked', 'done']),
], async (req, res) => {
  const {
    title, description, status, priority,
    assigned_to, deadline, estimated_hours,
    actual_hours, tags, metadata,
  } = req.body;
  try {
    const projectId = await getTaskProjectId(req.params.id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    if (!(await canStudentWorkOnProject(req.user, projectId))) {
      return res.status(403).json({ error: 'Only assigned students can update tasks' });
    }
    if (await isTaskProjectArchived(req.params.id)) {
      return res.status(403).json({ error: ARCHIVED_PROJECT_ERROR });
    }
    if (assigned_to && !(await isProjectMember(projectId, assigned_to))) {
      return res.status(400).json({ error: 'Assignee must be a project member' });
    }

    const previous = await pool.query(
      'SELECT title, status, priority, assigned_to FROM tasks WHERE id = $1',
      [req.params.id]
    );

    const result = await pool.query(`
      UPDATE tasks SET
        title           = COALESCE($1,  title),
        description     = COALESCE($2,  description),
        status          = COALESCE($3,  status),
        priority        = COALESCE($4,  priority),
        assigned_to     = COALESCE($5,  assigned_to),
        deadline        = COALESCE($6,  deadline),
        estimated_hours = COALESCE($7,  estimated_hours),
        actual_hours    = COALESCE($8,  actual_hours),
        tags            = COALESCE($9,  tags),
        metadata        = COALESCE($10, metadata)
      WHERE id = $11
      RETURNING *
    `, [title, description, status, priority, assigned_to,
        deadline, estimated_hours, actual_hours, tags, metadata, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });

    const full = await pool.query(`
      SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
      FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.id = $1
    `, [req.params.id]);
    const updatedTask = full.rows[0];
    const previousTask = previous.rows[0] || {};
    if (updatedTask.status === 'done') {
      await clearDeadlineNotificationsForTask(updatedTask.id);
    }

    const changes = {};
    ['title', 'status', 'priority', 'assigned_to'].forEach((field) => {
      if (previousTask[field] !== updatedTask[field]) {
        changes[field] = { from: previousTask[field], to: updatedTask[field] };
      }
    });

    await recordProjectEvent({
      projectId,
      actorId: req.user.id,
      eventType: 'task.updated',
      entityType: 'task',
      entityId: req.params.id,
      metadata: {
        title: updatedTask.title,
        changes,
      },
      notification: updatedTask.assigned_to ? {
        recipientIds: [updatedTask.assigned_to],
        skipActor: false,
        type: previousTask.assigned_to !== updatedTask.assigned_to ? 'task.assigned' : 'task.updated',
        category: previousTask.assigned_to !== updatedTask.assigned_to ? 'mentions' : 'updates',
        title: previousTask.assigned_to !== updatedTask.assigned_to
          ? `Task assigned: ${updatedTask.title}`
          : `Task updated: ${updatedTask.title}`,
        body: updatedTask.status ? `Current status: ${updatedTask.status.replace('_', ' ')}.` : '',
        actionUrl: `/projects/${projectId}/tasks`,
      } : null,
    });
    res.json({ task: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const projectId = await getTaskProjectId(req.params.id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    if (!(await canStudentWorkOnProject(req.user, projectId))) {
      return res.status(403).json({ error: 'Only assigned students can delete tasks' });
    }
    if (await isTaskProjectArchived(req.params.id)) {
      return res.status(403).json({ error: ARCHIVED_PROJECT_ERROR });
    }

    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND created_by = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found or unauthorized' });
    await recordProjectEvent({
      projectId,
      actorId: req.user.id,
      eventType: 'task.deleted',
      entityType: 'task',
      entityId: req.params.id,
      metadata: { taskId: req.params.id },
    });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/tasks/:id/dependencies ─────────────────────────────────────
router.get('/:id/dependencies', async (req, res) => {
  try {
    const projectId = await getTaskProjectId(req.params.id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    if (!(await canReadProject(req.user, projectId))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const parents = await pool.query(`
      SELECT td.dep_type, t.id, t.title, t.status, t.priority, t.deadline
      FROM task_dependencies td JOIN tasks t ON td.parent_task_id = t.id
      WHERE td.child_task_id = $1
    `, [req.params.id]);

    const children = await pool.query(`
      SELECT td.dep_type, t.id, t.title, t.status, t.priority, t.deadline
      FROM task_dependencies td JOIN tasks t ON td.child_task_id = t.id
      WHERE td.parent_task_id = $1
    `, [req.params.id]);

    res.json({ blockers: parents.rows, dependents: children.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/tasks/:id/dependencies ────────────────────────────────────
router.post('/:id/dependencies', [
  body('child_task_id').isUUID(),
  body('dep_type').optional().isIn(['blocks', 'related', 'subtask']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { child_task_id, dep_type = 'blocks' } = req.body;
  const parent_task_id = req.params.id;

  if (parent_task_id === child_task_id)
    return res.status(400).json({ error: 'A task cannot depend on itself' });

  try {
    const projectId = await getTaskProjectId(parent_task_id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    if (!(await canStudentWorkOnProject(req.user, projectId))) {
      return res.status(403).json({ error: 'Only assigned students can update task dependencies' });
    }
    if (await isDependencyProjectArchived(parent_task_id, child_task_id)) {
      return res.status(403).json({ error: ARCHIVED_PROJECT_ERROR });
    }
    const childProjectId = await getTaskProjectId(child_task_id);
    if (!childProjectId) return res.status(404).json({ error: 'Child task not found' });
    if (childProjectId !== projectId) {
      return res.status(400).json({ error: 'Dependencies must stay within one project' });
    }

    await pool.query(`
      INSERT INTO task_dependencies (parent_task_id, child_task_id, dep_type)
      VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
    `, [parent_task_id, child_task_id, dep_type]);
    await recordProjectEvent({
      projectId,
      actorId: req.user.id,
      eventType: 'task.dependency_created',
      entityType: 'task',
      entityId: child_task_id,
      metadata: { parentTaskId: parent_task_id, childTaskId: child_task_id, depType: dep_type },
    });
    res.status(201).json({ message: 'Dependency created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/tasks/:id/dependencies/:childId ─────────────────────────
router.delete('/:id/dependencies/:childId', async (req, res) => {
  try {
    const projectId = await getTaskProjectId(req.params.id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    if (!(await canStudentWorkOnProject(req.user, projectId))) {
      return res.status(403).json({ error: 'Only assigned students can update task dependencies' });
    }
    if (await isDependencyProjectArchived(req.params.id, req.params.childId)) {
      return res.status(403).json({ error: ARCHIVED_PROJECT_ERROR });
    }
    const childProjectId = await getTaskProjectId(req.params.childId);
    if (!childProjectId) return res.status(404).json({ error: 'Child task not found' });
    if (childProjectId !== projectId) {
      return res.status(400).json({ error: 'Dependencies must stay within one project' });
    }

    await pool.query(
      'DELETE FROM task_dependencies WHERE parent_task_id=$1 AND child_task_id=$2',
      [req.params.id, req.params.childId]
    );
    await recordProjectEvent({
      projectId,
      actorId: req.user.id,
      eventType: 'task.dependency_removed',
      entityType: 'task',
      entityId: req.params.childId,
      metadata: { parentTaskId: req.params.id, childTaskId: req.params.childId },
    });
    res.json({ message: 'Dependency removed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
