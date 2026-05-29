const express = require("express");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

async function canReadProject(user, projectId) {
  const result = await pool.query(
    `SELECT 1
     FROM projects p
     WHERE p.id = $1
       AND (
         p.owner_id = $2
         OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $2)
         OR p.visibility = 'public'
       )`,
    [projectId, user.id],
  );
  return result.rows.length > 0;
}

function titleFromText(text) {
  const normalized = String(text || "New chat").replace(/\s+/g, " ").trim();
  return normalized.slice(0, 80) || "New chat";
}

router.get("/sessions", async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });
    if (!(await canReadProject(req.user, projectId))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const result = await pool.query(
      `SELECT s.*,
              (
                SELECT text
                FROM ai_workbench_messages m
                WHERE m.session_id = s.id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message
       FROM ai_workbench_sessions s
       WHERE s.project_id = $1 AND s.user_id = $2
       ORDER BY s.updated_at DESC
       LIMIT 50`,
      [projectId, req.user.id],
    );

    res.json({ sessions: result.rows });
  } catch (err) {
    console.error("[AIWorkbench] Failed to list sessions:", err);
    res.status(500).json({ error: "Failed to load chat history" });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { projectId, activeAgent = "rag", title = "New chat" } = req.body;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });
    if (!(await canReadProject(req.user, projectId))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const result = await pool.query(
      `INSERT INTO ai_workbench_sessions (project_id, user_id, title, active_agent)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [projectId, req.user.id, titleFromText(title), activeAgent],
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error("[AIWorkbench] Failed to create session:", err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

router.get("/sessions/:id/messages", async (req, res) => {
  try {
    const session = await pool.query(
      `SELECT *
       FROM ai_workbench_sessions
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!session.rows.length) {
      return res.status(404).json({ error: "Chat session not found" });
    }

    const messages = await pool.query(
      `SELECT *
       FROM ai_workbench_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [req.params.id],
    );

    res.json({ session: session.rows[0], messages: messages.rows });
  } catch (err) {
    console.error("[AIWorkbench] Failed to load messages:", err);
    res.status(500).json({ error: "Failed to load chat messages" });
  }
});

router.post("/sessions/:id/messages", async (req, res) => {
  try {
    const { sender, agentId = null, text, metadata = {} } = req.body;
    if (!["user", "agent"].includes(sender) || !String(text || "").trim()) {
      return res.status(400).json({ error: "Valid sender and text are required" });
    }

    const session = await pool.query(
      `SELECT *
       FROM ai_workbench_sessions
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!session.rows.length) {
      return res.status(404).json({ error: "Chat session not found" });
    }

    const message = await pool.query(
      `INSERT INTO ai_workbench_messages (session_id, sender, agent_id, text, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, sender, agentId, String(text).trim(), metadata],
    );

    const sessionTitle =
      session.rows[0].title === "New chat" && sender === "user"
        ? titleFromText(text)
        : session.rows[0].title;
    const activeAgent = agentId || session.rows[0].active_agent;
    const updatedSession = await pool.query(
      `UPDATE ai_workbench_sessions
       SET title = $1,
           active_agent = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [sessionTitle, activeAgent, req.params.id],
    );

    res.status(201).json({
      message: message.rows[0],
      session: updatedSession.rows[0],
    });
  } catch (err) {
    console.error("[AIWorkbench] Failed to save message:", err);
    res.status(500).json({ error: "Failed to save chat message" });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM ai_workbench_sessions
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Chat session not found" });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error("[AIWorkbench] Failed to delete session:", err);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

module.exports = router;
