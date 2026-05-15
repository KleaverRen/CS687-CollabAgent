const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/tasks?project_id=&status=&assignee= ─────────────────────────
router.get('/', [
  query('project_id').notEmpty().withMessage('project_id required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { project_id, status, assigned_to } = req.query;
  try {
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

    res.status(201).json({ task: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
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
    res.json({ task: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND created_by = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found or unauthorized' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/tasks/:id/dependencies ─────────────────────────────────────
router.get('/:id/dependencies', async (req, res) => {
  try {
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
    await pool.query(`
      INSERT INTO task_dependencies (parent_task_id, child_task_id, dep_type)
      VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
    `, [parent_task_id, child_task_id, dep_type]);
    res.status(201).json({ message: 'Dependency created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/tasks/:id/dependencies/:childId ─────────────────────────
router.delete('/:id/dependencies/:childId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM task_dependencies WHERE parent_task_id=$1 AND child_task_id=$2',
      [req.params.id, req.params.childId]
    );
    res.json({ message: 'Dependency removed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/tasks/graph/:project_id ────────────────────────────────────
router.get('/graph/:project_id', async (req, res) => {
  try {
    const tasks = await pool.query(
      `SELECT id, title, status, priority, deadline, estimated_hours FROM tasks WHERE project_id = $1`,
      [req.params.project_id]
    );
    const edges = await pool.query(`
      SELECT td.parent_task_id, td.child_task_id, td.dep_type
      FROM task_dependencies td
      JOIN tasks t ON td.parent_task_id = t.id
      WHERE t.project_id = $1
    `, [req.params.project_id]);

    res.json({ nodes: tasks.rows, edges: edges.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
