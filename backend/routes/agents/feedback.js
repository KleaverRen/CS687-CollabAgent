const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const agentGate = require('../../middleware/agentGate');
const eventBroker = require('../../services/eventBroker');
const generationService = require('../../services/generationService');

// POST /api/agents/feedback/submit - Submit feedback and generate suggested responses
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { projectId, body, category, milestoneRef, severity } = req.body;
    
    if (!projectId || !body) {
      return res.status(400).json({ error: 'projectId and body are required' });
    }

    // Role check: Only advisors should technically submit feedback, but we allow it for demo purposes or check if req.user.role === 'advisor'
    if (req.user.role !== 'advisor' && req.user.role !== 'faculty') {
      // In a real app we might reject this. We'll proceed with a warning log.
      console.warn(`[FeedbackAgent] Non-advisor (${req.user.role}) is submitting feedback.`);
    }

    const fallbackResult = {
      structured_summary: "Feedback received.",
      suggested_response_template: "Acknowledge the feedback and outline next steps."
    };

    const systemPrompt = `You are the CollabAgent Advisor Feedback AI.
Analyze the following feedback from an academic advisor to a student team.
Respond strictly in valid JSON containing:
1. "structured_summary": A very brief 1-sentence summary of the main critique.
2. "suggested_response_template": A polite, professional template the students can use to reply to this feedback, containing placeholders like [Insert Date] or [Insert Action].

Format strictly as JSON.`;

    const parsed = await generationService.generateJson(systemPrompt, `Feedback:\n${body}`, fallbackResult);
    const structuredSummary = parsed.structured_summary || fallbackResult.structured_summary;
    const suggestedResponseTemplate = parsed.suggested_response_template || fallbackResult.suggested_response_template;

    // Insert into database
    const result = await pool.query(
      `INSERT INTO feedback (project_id, advisor_id, body, category, milestone_ref, severity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [projectId, req.user.id, body, category || 'general', milestoneRef || null, severity || 'medium', 'posted']
    );

    const newFeedback = result.rows[0];

    // Emit event for Team Coordination Agent
    eventBroker.publish('feedback.posted', {
      feedbackId: newFeedback.id,
      projectId,
      advisorId: req.user.id,
      severity: newFeedback.severity
    });

    res.status(201).json({
      feedback: newFeedback,
      structuredSummary,
      suggestedResponseTemplate
    });
  } catch (err) {
    console.error('[FeedbackAgent] Submit error:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/agents/feedback/open - Get unresolved feedback
router.get('/open', authenticate, async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const result = await pool.query(
      `SELECT f.*, u.full_name as advisor_name 
       FROM feedback f
       LEFT JOIN users u ON f.advisor_id = u.id
       WHERE f.project_id = $1 AND f.status != 'resolved'
       ORDER BY 
         CASE f.severity 
           WHEN 'high' THEN 1 
           WHEN 'medium' THEN 2 
           WHEN 'low' THEN 3 
           ELSE 4 
         END, 
         f.created_at DESC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[FeedbackAgent] Open feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch open feedback' });
  }
});

// POST /api/agents/feedback/respond - Student responds to feedback
router.post('/respond', authenticate, async (req, res) => {
  try {
    const { feedbackId, responseBody } = req.body;
    
    if (!feedbackId || !responseBody) {
      return res.status(400).json({ error: 'feedbackId and responseBody are required' });
    }

    // Insert response
    await pool.query(
      `INSERT INTO feedback_responses (feedback_id, student_id, body)
       VALUES ($1, $2, $3)`,
      [feedbackId, req.user.id, responseBody]
    );

    // Update feedback status
    const result = await pool.query(
      `UPDATE feedback SET status = 'responded' WHERE id = $1 RETURNING *`,
      [feedbackId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[FeedbackAgent] Respond error:', err);
    res.status(500).json({ error: 'Failed to record feedback response' });
  }
});

// POST /api/agents/feedback/resolve - Mark feedback as resolved (requires user confirmation)
router.post('/resolve', authenticate, agentGate, async (req, res) => {
  try {
    const { feedbackId } = req.body;
    
    if (!feedbackId) {
      return res.status(400).json({ error: 'feedbackId is required' });
    }

    const result = await pool.query(
      `UPDATE feedback SET status = 'resolved', resolved_at = NOW() WHERE id = $1 RETURNING *`,
      [feedbackId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[FeedbackAgent] Resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve feedback' });
  }
});

module.exports = router;
