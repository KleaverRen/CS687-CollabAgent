const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// All project routes require auth
router.use(authenticate);

// GET /api/projects - list user's projects
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name as owner_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) as doc_count,
        (SELECT COUNT(*) FROM agents a WHERE a.project_id = p.id) as agent_count
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE p.owner_id = $1
          OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)
       ORDER BY p.updated_at DESC`,
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - create project
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Project name required'),
    body('visibility')
      .optional()
      .isIn(['public', 'private', 'institution']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { name, description, visibility = 'private', tags } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO projects (name, description, owner_id, visibility, tags)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, description, req.user.id, visibility, tags || []]
      );
      // Auto-add owner as member
      await pool.query(
        `INSERT INTO project_members (project_id, user_id, member_role)
         VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
        [result.rows[0].id, req.user.id]
      );
      res.status(201).json({ project: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name as owner_name FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1 AND (
         p.owner_id = $2 OR
         p.id IN (SELECT project_id FROM project_members WHERE user_id = $2) OR
         p.visibility = 'public'
       )`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Project not found' });
    res.json({ project: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req, res) => {
  const { name, description, status, visibility, tags } = req.body;
  try {
    const result = await pool.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        visibility = COALESCE($4, visibility),
        tags = COALESCE($5, tags)
       WHERE id = $6 AND owner_id = $7
       RETURNING *`,
      [name, description, status, visibility, tags, req.params.id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    res.json({ project: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
