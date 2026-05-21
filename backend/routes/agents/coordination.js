const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const auth = require('../../middleware/auth');
const eventBroker = require('../../services/eventBroker');
const generationService = require('../../services/generationService');
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");

// POST /api/agents/coordination/meeting - Summarize meeting and extract tasks
router.post('/meeting', auth, async (req, res) => {
  try {
    const { transcript, projectId } = req.body;
    
    if (!transcript || !projectId) {
      return res.status(400).json({ error: 'Transcript and projectId are required' });
    }

    let summary = "Meeting summary not available (LLM parsing failed).";
    let actionItemDrafts = [];

    // Use Groq/LangChain for extraction if available
    if (generationService.groqClient) {
      const systemPrompt = `You are the CollabAgent Team Coordination AI.
Review the following meeting transcript.
Produce a response strictly in valid JSON format containing:
1. "summary": A brief 2-3 sentence summary of the meeting.
2. "action_items": An array of objects, each with:
   - "title": Action item description
   - "priority": low, medium, high, or urgent
   - "assignee_name": Name of the assignee if mentioned, otherwise null.

Format strictly as JSON.`;

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["user", "Transcript:\n{transcript}"]
      ]);

      const chain = prompt.pipe(generationService.groqClient).pipe(new StringOutputParser());
      const responseText = await chain.invoke({ transcript });
      
      try {
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        summary = parsed.summary || summary;
        actionItemDrafts = parsed.action_items || [];
      } catch (parseError) {
        console.error('[CoordinationAgent] Failed to parse LLM response:', responseText);
      }
    } else {
      // Fallback
      summary = "Fallback summary: " + transcript.substring(0, 100) + "...";
      actionItemDrafts = [{ title: "Review meeting notes", priority: "medium", assignee_name: null }];
    }

    // Log the meeting event
    await pool.query(
      `INSERT INTO activity_log (project_id, actor_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)`,
      [projectId, req.user.id, 'meeting.logged', { summary }]
    );

    res.json({
      summary,
      actionItemDrafts,
      requires_confirmation: true,
      message: "Action items extracted. Please pass them to the Task Management Agent to confirm."
    });
  } catch (err) {
    console.error('[CoordinationAgent] Meeting parse error:', err);
    res.status(500).json({ error: 'Failed to parse meeting transcript' });
  }
});

// GET /api/agents/coordination/activity - Get team activity feed
router.get('/activity', auth, async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const result = await pool.query(
      `SELECT a.*, u.full_name as actor_name 
       FROM activity_log a
       LEFT JOIN users u ON a.actor_id = u.id
       WHERE a.project_id = $1
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[CoordinationAgent] Activity fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// Register Event Consumers to log cross-agent activity
eventBroker.subscribe('task.assigned', 'CoordinationAgent', async (payload) => {
  try {
    await pool.query(
      `INSERT INTO activity_log (project_id, actor_id, event_type, metadata)
       VALUES ($1, NULL, $2, $3)`,
      [payload.projectId, 'task.assigned', { taskId: payload.taskId, title: payload.title }]
    );
  } catch (err) {
    console.error('[CoordinationAgent] Failed to log task.assigned:', err);
  }
});

eventBroker.subscribe('document.indexed', 'CoordinationAgent', async (payload) => {
  try {
    await pool.query(
      `INSERT INTO activity_log (project_id, actor_id, event_type, metadata)
       VALUES ($1, NULL, $2, $3)`,
      [payload.projectId, 'document.indexed', { documentId: payload.documentId, title: payload.title, chunks: payload.chunkCount }]
    );
  } catch (err) {
    console.error('[CoordinationAgent] Failed to log document.indexed:', err);
  }
});

module.exports = router;
