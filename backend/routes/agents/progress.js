const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const eventBroker = require('../../services/eventBroker');
const generationService = require('../../services/generationService');

function requireAdvisorAgent(req, res, next) {
  if (!['advisor', 'faculty'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Advisor Analyst is available to advisors only.' });
  }
  next();
}

// GET /api/agents/progress/dashboard - Aggregated health metrics
router.get('/dashboard', authenticate, requireAdvisorAgent, async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // 1. Task metrics
    const taskRes = await pool.query(`SELECT status FROM tasks WHERE project_id = $1`, [projectId]);
    const tasks = taskRes.rows;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 2. Open Feedback metrics
    const feedbackRes = await pool.query(`SELECT COUNT(*) as count FROM feedback WHERE project_id = $1 AND status != 'resolved'`, [projectId]);
    const openFeedbackCount = parseInt(feedbackRes.rows[0].count, 10);

    // 3. Recent Activity Velocity (events in last 7 days)
    const activityRes = await pool.query(
      `SELECT COUNT(*) as count FROM activity_log 
       WHERE project_id = $1 AND created_at > NOW() - INTERVAL '7 days'`, 
      [projectId]
    );
    const weeklyVelocity = parseInt(activityRes.rows[0].count, 10);

    res.json({
      metrics: {
        totalTasks,
        completedTasks,
        completionPct,
        openFeedbackCount,
        weeklyVelocity
      }
    });
  } catch (err) {
    console.error('[ProgressAgent] Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch progress metrics' });
  }
});

// GET /api/agents/progress/risks - Prioritized risk register
router.get('/risks', authenticate, requireAdvisorAgent, async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const result = await pool.query(
      `SELECT * FROM risk_register 
       WHERE project_id = $1 AND is_resolved = false
       ORDER BY 
         CASE severity 
           WHEN 'high' THEN 1 
           WHEN 'medium' THEN 2 
           WHEN 'low' THEN 3 
           ELSE 4 
         END, 
         created_at DESC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[ProgressAgent] Risks error:', err);
    res.status(500).json({ error: 'Failed to fetch risk register' });
  }
});

// GET /api/agents/progress/report - Generate a narrative progress report via LLM
router.get('/report', authenticate, requireAdvisorAgent, async (req, res) => {
  try {
    const { projectId, provider = null } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    // Gather raw data for the LLM
    const [tasks, feedback, risks] = await Promise.all([
      pool.query(`SELECT title, status, priority FROM tasks WHERE project_id = $1`, [projectId]),
      pool.query(`SELECT category, severity, status FROM feedback WHERE project_id = $1 AND status != 'resolved'`, [projectId]),
      pool.query(`SELECT risk_type, severity, description FROM risk_register WHERE project_id = $1 AND is_resolved = false`, [projectId])
    ]);

    const statsContext = `
Tasks: ${tasks.rows.length} total.
Feedback: ${feedback.rows.length} unresolved items.
Risks: ${risks.rows.length} active risks.
Detailed Tasks: ${JSON.stringify(tasks.rows)}
Detailed Risks: ${JSON.stringify(risks.rows)}
`;

    const fallbackReport = `### Fallback Report\nWe currently have ${tasks.rows.length} tasks and ${risks.rows.length} risks.`;
    const systemPrompt = `You are the CollabAgent Progress Monitoring AI.
Based on the provided raw JSON data about tasks, feedback, and risks, write a concise, professional 3-paragraph Markdown progress report.
Format:
### Executive Summary
[Paragraph]
### Current Velocity & Tasks
[Paragraph]
### Risk Assessment & Recommendations
[Paragraph]`;

    const reportMarkdown = await generationService.generateText(systemPrompt, `Data context:\n${statsContext}`, fallbackReport, provider || null);

    res.json({ report: reportMarkdown });
  } catch (err) {
    console.error('[ProgressAgent] Report error:', err);
    res.status(500).json({ error: 'Failed to generate progress report' });
  }
});

// Event Consumers for Auto-Risk Generation
eventBroker.subscribe('feedback.posted', 'ProgressAgent', async (payload) => {
  try {
    // Automatically flag high-severity feedback as a project risk
    if (payload.severity === 'high' || payload.severity === 'urgent') {
      await pool.query(
        `INSERT INTO risk_register (project_id, risk_type, severity, description, source_ref, suggested_action)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          payload.projectId, 
          'unresolved_high_severity_feedback', 
          'high', 
          'High severity feedback requires immediate team attention.', 
          `feedback_${payload.feedbackId}`, 
          'Review the feedback thread and draft a response immediately.'
        ]
      );
    }
  } catch (err) {
    console.error('[ProgressAgent] Failed to log risk from feedback:', err);
  }
});

module.exports = router;
