const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");
const eventBroker = require("../services/eventBroker");
const {
  createNotification,
  getUnreadCount,
  recordProjectEvent,
} = require("../services/notificationService");

const router = express.Router({ mergeParams: true });

const MAX_MESSAGE_LENGTH = 5000;
const DEFAULT_LIMIT = 50;

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

function clampLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), 100);
}

function serializeProjectMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: "project",
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

function serializeDirectMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: "direct",
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: row.content,
    sender_name: row.sender_name,
    sender_avatar: row.sender_avatar || null,
    sender_role: row.sender_role,
    created_at: row.created_at,
    edited_at: row.edited_at || null,
  };
}

async function getProjectMembership(projectId, userId, client = pool) {
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

async function getProjectMemberIds(projectId, client = pool) {
  const result = await client.query(
    `SELECT user_id FROM project_members WHERE project_id = $1`,
    [projectId],
  );
  return result.rows.map((row) => row.user_id);
}

async function getDirectMemberIds(conversationId, client = pool) {
  const result = await client.query(
    `SELECT user_id FROM direct_conversation_members WHERE conversation_id = $1`,
    [conversationId],
  );
  return result.rows.map((row) => row.user_id);
}

async function getDirectMembership(conversationId, userId, client = pool) {
  const result = await client.query(
    `SELECT 1
     FROM direct_conversation_members
     WHERE conversation_id = $1
       AND user_id = $2`,
    [conversationId, userId],
  );
  return result.rows.length > 0;
}

async function canDirectMessage(senderId, recipientId, client = pool) {
  if (!senderId || !recipientId || senderId === recipientId) return false;

  const result = await client.query(
    `SELECT 1
     FROM project_members mine
     JOIN project_members theirs ON theirs.project_id = mine.project_id
     WHERE mine.user_id = $1
       AND theirs.user_id = $2
     LIMIT 1`,
    [senderId, recipientId],
  );
  return result.rows.length > 0;
}

async function fetchProjectMessage(messageId, projectId, client = pool) {
  const result = await client.query(
    `SELECT pm.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role
     FROM project_messages pm
     JOIN users u ON u.id = pm.sender_id
     WHERE pm.id = $1
       AND pm.project_id = $2`,
    [messageId, projectId],
  );
  return serializeProjectMessage(result.rows[0]);
}

async function fetchDirectMessage(messageId, conversationId, client = pool) {
  const result = await client.query(
    `SELECT dm.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role
     FROM direct_messages dm
     JOIN users u ON u.id = dm.sender_id
     WHERE dm.id = $1
       AND dm.conversation_id = $2`,
    [messageId, conversationId],
  );
  return serializeDirectMessage(result.rows[0]);
}

async function findDirectConversation(userId, recipientId, client = pool) {
  const result = await client.query(
    `SELECT dcm.conversation_id
     FROM direct_conversation_members dcm
     WHERE dcm.user_id = ANY($1::uuid[])
     GROUP BY dcm.conversation_id
     HAVING COUNT(*) = 2
        AND COUNT(*) FILTER (WHERE dcm.user_id = $2) = 1
        AND COUNT(*) FILTER (WHERE dcm.user_id = $3) = 1
     LIMIT 1`,
    [[userId, recipientId], userId, recipientId],
  );
  return result.rows[0]?.conversation_id || null;
}

async function ensureDirectConversation(userId, recipientId, client = pool) {
  const existingId = await findDirectConversation(userId, recipientId, client);
  if (existingId) return existingId;

  const created = await client.query(
    `INSERT INTO direct_conversations DEFAULT VALUES RETURNING id`,
  );
  const conversationId = created.rows[0].id;
  await client.query(
    `INSERT INTO direct_conversation_members (conversation_id, user_id)
     VALUES ($1, $2), ($1, $3)`,
    [conversationId, userId, recipientId],
  );
  return conversationId;
}

async function publishChatEvent(userIds, chatEvent) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      eventBroker.publish(`notifications.user.${userId}`, {
        notification: null,
        unreadCount: await getUnreadCount(userId),
        chatEvent,
      });
    }),
  );
}

router.get("/conversations", async (req, res) => {
  try {
    const projectRooms = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.status,
         p.updated_at,
         (SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
         latest.content AS last_message,
         latest.created_at AS last_message_at,
         latest.sender_name AS last_sender_name,
         (
           SELECT COUNT(*)::int
           FROM notifications n
           WHERE n.user_id = $1
             AND n.type = 'chat.message'
             AND n.project_id = p.id
             AND n.is_read = FALSE
         ) AS unread_count
       FROM projects p
       LEFT JOIN LATERAL (
         SELECT pm.content, pm.created_at, u.full_name AS sender_name
         FROM project_messages pm
         JOIN users u ON u.id = pm.sender_id
         WHERE pm.project_id = p.id
         ORDER BY pm.created_at DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE p.owner_id = $1
          OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)
       ORDER BY COALESCE(latest.created_at, p.updated_at, p.created_at) DESC`,
      [req.user.id],
    );

    const directThreads = await pool.query(
      `SELECT
         dc.id,
         dc.updated_at,
         other_user.id AS other_user_id,
         other_user.full_name AS other_user_name,
         other_user.avatar_url AS other_user_avatar,
         other_user.role AS other_user_role,
         latest.content AS last_message,
         latest.created_at AS last_message_at,
         latest.sender_name AS last_sender_name,
         (
           SELECT COUNT(*)::int
           FROM notifications n
           WHERE n.user_id = $1
             AND n.type = 'chat.direct_message'
             AND n.metadata->>'conversation_id' = dc.id::text
             AND n.is_read = FALSE
         ) AS unread_count
       FROM direct_conversations dc
       JOIN direct_conversation_members mine
         ON mine.conversation_id = dc.id
        AND mine.user_id = $1
       JOIN direct_conversation_members other_member
         ON other_member.conversation_id = dc.id
        AND other_member.user_id <> $1
       JOIN users other_user ON other_user.id = other_member.user_id
       LEFT JOIN LATERAL (
         SELECT dm.content, dm.created_at, u.full_name AS sender_name
         FROM direct_messages dm
         JOIN users u ON u.id = dm.sender_id
         WHERE dm.conversation_id = dc.id
         ORDER BY dm.created_at DESC
         LIMIT 1
       ) latest ON TRUE
       ORDER BY COALESCE(latest.created_at, dc.updated_at, dc.created_at) DESC`,
      [req.user.id],
    );

    res.json({
      conversations: [
        ...projectRooms.rows.map((row) => ({
          id: `project:${row.id}`,
          type: "project",
          project_id: row.id,
          title: row.name,
          subtitle: `${row.member_count} ${row.member_count === 1 ? "member" : "members"}`,
          member_count: row.member_count,
          last_message: row.last_message,
          last_message_at: row.last_message_at,
          last_sender_name: row.last_sender_name,
          unread_count: row.unread_count || 0,
        })),
        ...directThreads.rows.map((row) => ({
          id: `direct:${row.id}`,
          type: "direct",
          conversation_id: row.id,
          title: row.other_user_name,
          subtitle: row.other_user_role,
          other_user: {
            id: row.other_user_id,
            full_name: row.other_user_name,
            avatar_url: row.other_user_avatar,
            role: row.other_user_role,
          },
          last_message: row.last_message,
          last_message_at: row.last_message_at,
          last_sender_name: row.last_sender_name,
          unread_count: row.unread_count || 0,
        })),
      ].sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      }),
    });
  } catch (err) {
    console.error("[Chat] Conversations error:", err);
    res.status(500).json({ error: "Failed to load chat conversations" });
  }
});

router.get("/contacts", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.email, u.avatar_url, u.role
       FROM project_members mine
       JOIN project_members teammate
         ON teammate.project_id = mine.project_id
        AND teammate.user_id <> mine.user_id
       JOIN users u ON u.id = teammate.user_id
       WHERE mine.user_id = $1
       ORDER BY u.full_name ASC`,
      [req.user.id],
    );
    res.json({ contacts: result.rows });
  } catch (err) {
    console.error("[Chat] Contacts error:", err);
    res.status(500).json({ error: "Failed to load chat contacts" });
  }
});

router.post(
  "/direct",
  [body("recipient_id").isUUID()],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (!(await canDirectMessage(req.user.id, req.body.recipient_id, client))) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Direct messages are limited to project teammates",
        });
      }

      const conversationId = await ensureDirectConversation(
        req.user.id,
        req.body.recipient_id,
        client,
      );

      await client.query("COMMIT");
      res.status(201).json({ conversation_id: conversationId });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[Chat] Start direct conversation error:", err);
      res.status(500).json({ error: "Failed to start direct conversation" });
    } finally {
      client.release();
    }
  },
);

router.get(
  "/direct/:conversationId/messages",
  [
    param("conversationId").isUUID(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("before").optional().isISO8601(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      if (
        !(await getDirectMembership(req.params.conversationId, req.user.id))
      ) {
        return res.status(403).json({ error: "Conversation membership required" });
      }

      const params = [req.params.conversationId];
      let beforeFilter = "";
      if (req.query.before) {
        params.push(req.query.before);
        beforeFilter = `AND dm.created_at < $${params.length}`;
      }
      params.push(clampLimit(req.query.limit));

      const result = await pool.query(
        `SELECT dm.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role
         FROM direct_messages dm
         JOIN users u ON u.id = dm.sender_id
         WHERE dm.conversation_id = $1
         ${beforeFilter}
         ORDER BY dm.created_at DESC
         LIMIT $${params.length}`,
        params,
      );

      res.json({ messages: result.rows.reverse().map(serializeDirectMessage) });
    } catch (err) {
      console.error("[Chat] Direct message list error:", err);
      res.status(500).json({ error: "Failed to load direct messages" });
    }
  },
);

router.post(
  "/direct/:conversationId/messages",
  [param("conversationId").isUUID(), body("content").isString()],
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

      const conversationId = req.params.conversationId;
      if (!(await getDirectMembership(conversationId, req.user.id, client))) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Conversation membership required" });
      }

      const insertResult = await client.query(
        `INSERT INTO direct_messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [conversationId, req.user.id, content],
      );
      await client.query(
        `UPDATE direct_conversations SET updated_at = NOW() WHERE id = $1`,
        [conversationId],
      );

      const message = await fetchDirectMessage(
        insertResult.rows[0].id,
        conversationId,
        client,
      );
      const memberIds = await getDirectMemberIds(conversationId, client);
      const recipients = memberIds.filter((id) => id !== req.user.id);

      for (const userId of recipients) {
        await createNotification(
          {
            userId,
            actorId: req.user.id,
            type: "chat.direct_message",
            category: "messages",
            title: `New message from ${message.sender_name}`,
            body: content.slice(0, 200),
            entityType: "direct_message",
            entityId: message.id,
            actionUrl: `/chat?conversation=direct:${conversationId}`,
            metadata: {
              conversation_id: conversationId,
              message,
              preview: content.slice(0, 100),
            },
          },
          client,
        );
      }

      await client.query("COMMIT");
      await publishChatEvent(memberIds, {
        action: "created",
        conversationType: "direct",
        conversationId,
        message,
      });

      res.status(201).json({ message });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[Chat] Direct send error:", err);
      res.status(500).json({ error: "Failed to send direct message" });
    } finally {
      client.release();
    }
  },
);

router.patch(
  "/direct/:conversationId/messages/:messageId",
  [
    param("conversationId").isUUID(),
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
      const conversationId = req.params.conversationId;
      if (!(await getDirectMembership(conversationId, req.user.id))) {
        return res.status(403).json({ error: "Conversation membership required" });
      }

      const result = await pool.query(
        `UPDATE direct_messages
         SET content = $1, edited_at = NOW()
         WHERE id = $2
           AND conversation_id = $3
           AND sender_id = $4
         RETURNING id`,
        [content, req.params.messageId, conversationId, req.user.id],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Message not found" });
      }

      const message = await fetchDirectMessage(result.rows[0].id, conversationId);
      await publishChatEvent(await getDirectMemberIds(conversationId), {
        action: "updated",
        conversationType: "direct",
        conversationId,
        message,
      });

      res.json({ message });
    } catch (err) {
      console.error("[Chat] Direct edit error:", err);
      res.status(500).json({ error: "Failed to edit direct message" });
    }
  },
);

router.delete(
  "/direct/:conversationId/messages/:messageId",
  [param("conversationId").isUUID(), param("messageId").isUUID()],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const conversationId = req.params.conversationId;
      if (!(await getDirectMembership(conversationId, req.user.id))) {
        return res.status(403).json({ error: "Conversation membership required" });
      }

      const result = await pool.query(
        `UPDATE direct_messages
         SET content = '[deleted]', edited_at = NOW()
         WHERE id = $1
           AND conversation_id = $2
           AND sender_id = $3
         RETURNING id`,
        [req.params.messageId, conversationId, req.user.id],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Message not found" });
      }

      const message = await fetchDirectMessage(result.rows[0].id, conversationId);
      await publishChatEvent(await getDirectMemberIds(conversationId), {
        action: "deleted",
        conversationType: "direct",
        conversationId,
        message,
      });

      res.status(204).send();
    } catch (err) {
      console.error("[Chat] Direct delete error:", err);
      res.status(500).json({ error: "Failed to delete direct message" });
    }
  },
);

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
      const membership = await getProjectMembership(projectId, req.user.id);
      if (!membership) {
        return res.status(403).json({ error: "Project membership required" });
      }

      const params = [projectId];
      let beforeFilter = "";
      if (req.query.before) {
        params.push(req.query.before);
        beforeFilter = `AND pm.created_at < $${params.length}`;
      }
      params.push(clampLimit(req.query.limit));

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

      res.json({ messages: result.rows.reverse().map(serializeProjectMessage) });
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
      const membership = await getProjectMembership(projectId, req.user.id, client);
      if (!membership) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Project membership required" });
      }

      const insertResult = await client.query(
        `INSERT INTO project_messages (project_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [projectId, req.user.id, content],
      );

      const message = await fetchProjectMessage(
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
              conversation_id: `project:${projectId}`,
              message,
              preview: content.slice(0, 100),
            },
          },
        },
        client,
      );

      const memberIds = await getProjectMemberIds(projectId, client);
      await client.query("COMMIT");

      eventBroker.publish(`chat.project.${projectId}`, { message });
      await publishChatEvent(memberIds, {
        action: "created",
        conversationType: "project",
        projectId,
        message,
      });
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
      const membership = await getProjectMembership(projectId, req.user.id);
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

      const message = await fetchProjectMessage(result.rows[0].id, projectId);
      await publishChatEvent(await getProjectMemberIds(projectId), {
        action: "updated",
        conversationType: "project",
        projectId,
        message,
      });

      res.json({ message });
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
      const membership = await getProjectMembership(projectId, req.user.id);
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

      const message = await fetchProjectMessage(result.rows[0].id, projectId);
      await publishChatEvent(await getProjectMemberIds(projectId), {
        action: "deleted",
        conversationType: "project",
        projectId,
        message,
      });

      res.status(204).send();
    } catch (err) {
      console.error("[Chat] Delete error:", err);
      res.status(500).json({ error: "Failed to delete chat message" });
    }
  },
);

module.exports = router;
