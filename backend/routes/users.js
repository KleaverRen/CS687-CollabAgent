const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/users/profile
router.get('/profile', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, avatar_url, institution, bio, created_at,
        (SELECT COUNT(*) FROM projects WHERE owner_id = u.id) as projects_owned,
        (SELECT COUNT(*) FROM project_members WHERE user_id = u.id) as projects_joined
       FROM users u WHERE id = $1`,
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/profile
router.patch(
  '/profile',
  [
    body('full_name').optional().trim().notEmpty(),
    body('institution').optional().trim(),
    body('bio').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { full_name, institution, bio, avatar_url } = req.body;
    try {
      const result = await pool.query(
        `UPDATE users SET
          full_name = COALESCE($1, full_name),
          institution = COALESCE($2, institution),
          bio = COALESCE($3, bio),
          avatar_url = COALESCE($4, avatar_url)
         WHERE id = $5
         RETURNING id, full_name, email, role, avatar_url, institution, bio`,
        [full_name, institution, bio, avatar_url, req.user.id]
      );
      res.json({ user: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/users/password
router.patch(
  '/password',
  [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { current_password, new_password } = req.body;
    try {
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );
      const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

      const hash = await bcrypt.hash(new_password, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        hash, req.user.id,
      ]);
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/users/dashboard-stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM projects WHERE owner_id = $1) as total_projects,
        (SELECT COUNT(*) FROM projects WHERE owner_id = $1 AND status = 'active') as active_projects,
        (SELECT COUNT(*) FROM project_members WHERE user_id = $1) as collaborations,
        (SELECT COUNT(*) FROM documents d
          JOIN projects p ON d.project_id = p.id
          WHERE p.owner_id = $1) as total_documents`,
      [req.user.id]
    );
    res.json({ stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
