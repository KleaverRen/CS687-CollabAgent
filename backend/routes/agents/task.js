const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const agentGate = require('../../middleware/agentGate');
const eventBroker = require('../../services/eventBroker');
const generationService = require('../../services/generationService');

function normalizePriority(priority) {
  const normalized = String(priority || 'medium').toLowerCase();
  return ['low', 'medium', 'high', 'urgent'].includes(normalized) ? normalized : 'medium';
}

// POST /api/agents/task/parse - Parse NL task request into a draft
router.post('/parse', authenticate, async (req, res) => {
  try {
    const { request, projectId } = req.body;
    
    if (!request || !projectId) {
      return res.status(400).json({ error: 'Request text and projectId are required' });
    }

    const fallbackDraft = {
      title: request.substring(0, 50) + "...",
      priority: "medium",
      assignee_name: null
    };

    const systemPrompt = `You are the CollabAgent Task Management AI. 
Extract the following details from the user's request: title, priority (low, medium, high, urgent), and assignee_name (if mentioned).
Respond strictly with valid JSON.
Format: { "title": "string", "priority": "string", "assignee_name": "string or null" }`;

    const draft = await generationService.generateJson(systemPrompt, request, fallbackDraft);
    draft.priority = normalizePriority(draft.priority);

    // Return the draft to the user for confirmation (no DB write yet)
    res.json({
      draft,
      requires_confirmation: true,
      message: "Please review and confirm this task draft before creation."
    });
  } catch (err) {
    console.error('[TaskAgent] Parse error:', err);
    res.status(500).json({ error: 'Failed to parse task request' });
  }
});

// POST /api/agents/task/confirm - Commit task to DB (Requires user_confirmed: true)
router.post('/confirm', authenticate, agentGate, async (req, res) => {
  try {
    const { draft, projectId } = req.body;
    
    if (!draft || !draft.title || !projectId) {
      return res.status(400).json({ error: 'Valid draft and projectId required' });
    }

    // Write to database
    const result = await pool.query(
      `INSERT INTO tasks (title, priority, project_id, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [draft.title, draft.priority || 'medium', projectId, 'backlog']
    );

    const newTask = result.rows[0];

    // Emit event to broker so Team Coordination Agent can log it
    eventBroker.publish('task.assigned', {
      taskId: newTask.id,
      projectId,
      title: newTask.title,
      priority: newTask.priority
    });

    res.status(201).json(newTask);
  } catch (err) {
    console.error('[TaskAgent] Confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm and create task' });
  }
});

// GET /api/agents/task/prioritized - Get tasks ranked by priority
router.get('/prioritized', authenticate, async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
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
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[TaskAgent] Prioritized error:', err);
    res.status(500).json({ error: 'Failed to fetch prioritized tasks' });
  }
});

module.exports = router;
