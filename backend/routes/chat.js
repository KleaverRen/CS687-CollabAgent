const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");
const eventBroker = require("../services/eventBroker");
const { recordProjectEvent } = require("../services/notificationService");

const router = express.Router({ mergeParams: true });

const MAX_MESSAGE_LENGTH = 5000;

router.use(authenticate);

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

function sanitizeContent(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function serializeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    sender_id: row.sender_id,
    content: row.content,
    sender_name: row.sender_name,
    sender_avatar: row.sender_avatar || null,
    sender_role: row.sender_role,
    created_at: row.created_at,
    edited_at: row.edited_at || null,
  };
}

async function getMembership(projectId, userId, client = pool) {
  const result = await client.query(
    `SELECT p.owner_id, pm.member_role
     FROM projects p
     LEFT JOIN project_members pm
       ON pm.project_id = p.id
      AND pm.user_id = $2
     WHERE p.id = $1`,
    [projectId, userId],
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];
  const isOwner = row.owner_id === userId;
  if (!row.member_role && !isOwner) return null;
  return { isOwner, memberRole: row.member_role };
}

async function fetchMessage(messageId, projectId, client = pool) {
  const result = await client.query(
    `SELECT pm.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role
     FROM project_messages pm
     JOIN users u ON u.id = pm.sender_id
     WHERE pm.id = $1
       AND pm.project_id = $2`,
    [messageId, projectId],
  );
  return serializeMessage(result.rows[0]);
}

router.get(
  "/",
  [
    param("projectId").isUUID(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("before").optional().isISO8601(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const projectId = req.params.projectId;
      const membership = await getMembership(projectId, req.user.id);
      if (!membership) {
        return res.status(403).json({ error: "Project membership required" });
      }

      const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100);
      const params = [projectId];
      let beforeFilter = "";
      if (req.query.before) {
        params.push(req.query.before);
        beforeFilter = `AND pm.created_at < $${params.length}`;
      }
      params.push(limit);

      const result = await pool.query(
        `SELECT pm.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role
         FROM project_messages pm
         JOIN users u ON u.id = pm.sender_id
         WHERE pm.project_id = $1
         ${beforeFilter}
         ORDER BY pm.created_at DESC
         LIMIT $${params.length}`,
        params,
      );

      res.json({ messages: result.rows.reverse().map(serializeMessage) });
    } catch (err) {
      console.error("[Chat] List error:", err);
      res.status(500).json({ error: "Failed to load chat messages" });
    }
  },
);

router.post(
  "/",
  [param("projectId").isUUID(), body("content").isString()],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const content = sanitizeContent(req.body.content);
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message content must be between 1 and ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const projectId = req.params.projectId;
      const membership = await getMembership(projectId, req.user.id, client);
      if (!membership) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Project membership required" });
      }

      const insertResult = await client.query(
        `INSERT INTO project_messages (project_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [projectId, req.user.id, content],
      );

      const message = await fetchMessage(
        insertResult.rows[0].id,
        projectId,
        client,
      );

      await recordProjectEvent(
        {
          projectId,
          actorId: req.user.id,
          eventType: "chat.message_sent",
          entityType: "project_message",
          entityId: message.id,
          metadata: { preview: content.slice(0, 100) },
          notification: {
            type: "chat.message",
            category: "messages",
            title: `New message from ${message.sender_name}`,
            body: content.slice(0, 200),
            actionUrl: `/projects/${projectId}?chat=open`,
            metadata: {
              message,
              preview: content.slice(0, 100),
            },
          },
        },
        client,
      );

      await client.query("COMMIT");

      eventBroker.publish(`chat.project.${projectId}`, { message });
      res.status(201).json({ message });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[Chat] Create error:", err);
      res.status(500).json({ error: "Failed to send chat message" });
    } finally {
      client.release();
    }
  },
);

router.patch(
  "/:messageId",
  [
    param("projectId").isUUID(),
    param("messageId").isUUID(),
    body("content").isString(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const content = sanitizeContent(req.body.content);
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message content must be between 1 and ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    try {
      const projectId = req.params.projectId;
      const membership = await getMembership(projectId, req.user.id);
      if (!membership) {
        return res.status(403).json({ error: "Project membership required" });
      }

      const result = await pool.query(
        `UPDATE project_messages
         SET content = $1, edited_at = NOW()
         WHERE id = $2
           AND project_id = $3
           AND sender_id = $4
         RETURNING id`,
        [content, req.params.messageId, projectId, req.user.id],
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.json({ message: await fetchMessage(result.rows[0].id, projectId) });
    } catch (err) {
      console.error("[Chat] Edit error:", err);
      res.status(500).json({ error: "Failed to edit chat message" });
    }
  },
);

router.delete(
  "/:messageId",
  [param("projectId").isUUID(), param("messageId").isUUID()],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const projectId = req.params.projectId;
      const membership = await getMembership(projectId, req.user.id);
      if (!membership) {
        return res.status(403).json({ error: "Project membership required" });
      }

      const result = await pool.query(
        `UPDATE project_messages
         SET content = '[deleted]', edited_at = NOW()
         WHERE id = $1
           AND project_id = $2
           AND (sender_id = $3 OR $4 = TRUE)
         RETURNING id`,
        [req.params.messageId, projectId, req.user.id, membership.isOwner],
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.status(204).send();
    } catch (err) {
      console.error("[Chat] Delete error:", err);
      res.status(500).json({ error: "Failed to delete chat message" });
    }
  },
);

module.exports = router;
