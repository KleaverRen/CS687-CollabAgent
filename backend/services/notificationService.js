const pool = require("../config/database");
const eventBroker = require("./eventBroker");

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function clampLimit(limit, fallback = DEFAULT_LIMIT) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};
}

function serializeNotification(row) {
  if (!row) return null;
  return {
    ...row,
    link: row.link || row.action_url || null,
    action_url: row.action_url || row.link || null,
    is_read: Boolean(row.is_read || row.read_at),
    read_at: row.read_at || (row.is_read ? row.created_at : null),
  };
}

async function getProjectMemberIds(projectId, client = pool) {
  const result = await client.query(
    `SELECT user_id FROM project_members WHERE project_id = $1`,
    [projectId],
  );
  return result.rows.map((row) => row.user_id);
}

async function publishNotification(notification) {
  const unreadCount = await getUnreadCount(notification.user_id);
  eventBroker.publish(`notifications.user.${notification.user_id}`, {
    notification,
    unreadCount,
  });
}

async function createActivity(
  {
    projectId,
    actorId = null,
    eventType,
    entityType = null,
    entityId = null,
    visibility = "project",
    metadata = {},
  },
  client = pool,
) {
  const result = await client.query(
    `INSERT INTO activity_log
      (project_id, actor_id, event_type, entity_type, entity_id, visibility, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      projectId,
      actorId,
      eventType,
      entityType,
      entityId,
      visibility,
      normalizeMetadata(metadata),
    ],
  );
  const activity = result.rows[0];
  eventBroker.publish("activity.created", { activity });
  if (projectId) {
    eventBroker.publish(`activity.project.${projectId}`, { activity });
  }
  return activity;
}

async function createNotification(
  {
    userId,
    actorId = null,
    projectId = null,
    activityId = null,
    type,
    category = "updates",
    title,
    body = "",
    entityType = null,
    entityId = null,
    actionUrl = null,
    link = null,
    metadata = {},
  },
  client = pool,
) {
  const finalLink = link || actionUrl || null;
  const result = await client.query(
    `INSERT INTO notifications
      (user_id, actor_id, project_id, activity_id, type, category, title, body,
       entity_type, entity_id, action_url, link, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      userId,
      actorId,
      projectId,
      activityId,
      type,
      category,
      title,
      body,
      entityType,
      entityId,
      finalLink,
      finalLink,
      normalizeMetadata(metadata),
    ],
  );
  const notification = serializeNotification(result.rows[0]);
  await publishNotification(notification);
  return notification;
}

async function notifyUsers(userIds, payload, client = pool) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  const notifications = [];

  for (const userId of uniqueUserIds) {
    if (
      payload.actorId &&
      payload.actorId === userId &&
      payload.skipActor !== false
    ) {
      continue;
    }
    notifications.push(
      await createNotification({ ...payload, userId }, client),
    );
  }

  return notifications;
}

async function recordProjectEvent(
  {
    projectId,
    actorId,
    eventType,
    entityType = null,
    entityId = null,
    metadata = {},
    notification = null,
  },
  client = pool,
) {
  const activity = await createActivity(
    {
      projectId,
      actorId,
      eventType,
      entityType,
      entityId,
      metadata,
    },
    client,
  );

  if (notification) {
    const recipientIds =
      notification.recipientIds ||
      (await getProjectMemberIds(projectId, client));
    await notifyUsers(
      recipientIds,
      {
        actorId,
        projectId,
        activityId: activity.id,
        entityType,
        entityId,
        ...notification,
      },
      client,
    );
  }

  return activity;
}

async function listNotifications(userId, { limit, before, unreadOnly } = {}) {
  const params = [userId];
  let where = "n.user_id = $1";

  if (before) {
    params.push(before);
    where += ` AND n.created_at < $${params.length}`;
  }

  if (unreadOnly) {
    where += " AND n.is_read = FALSE";
  }

  params.push(clampLimit(limit));
  const result = await pool.query(
    `SELECT n.*, actor.full_name AS actor_name, p.name AS project_name
     FROM notifications n
     LEFT JOIN users actor ON actor.id = n.actor_id
     LEFT JOIN projects p ON p.id = n.project_id
     WHERE ${where}
     ORDER BY n.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(serializeNotification);
}

async function getUnreadCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId],
  );
  return result.rows[0]?.count || 0;
}

async function markNotificationRead(userId, notificationId) {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId],
  );
  return serializeNotification(result.rows[0]);
}

async function markAllNotificationsRead(userId) {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1 AND is_read = FALSE
     RETURNING id`,
    [userId],
  );
  return result.rowCount;
}

async function listActivity(userId, { projectId, limit, before } = {}) {
  const params = [userId];
  let where = `(
    a.actor_id = $1
    OR a.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)
    OR a.project_id IN (SELECT id FROM projects WHERE owner_id = $1 OR visibility = 'public')
  )`;

  if (projectId) {
    params.push(projectId);
    where += ` AND a.project_id = $${params.length}`;
  }

  if (before) {
    params.push(before);
    where += ` AND a.created_at < $${params.length}`;
  }

  params.push(clampLimit(limit, 50));
  const result = await pool.query(
    `SELECT a.*, actor.full_name AS actor_name, actor.avatar_url AS actor_avatar, p.name AS project_name
     FROM activity_log a
     LEFT JOIN users actor ON actor.id = a.actor_id
     LEFT JOIN projects p ON p.id = a.project_id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}

module.exports = {
  clampLimit,
  createActivity,
  createNotification,
  serializeNotification,
  getProjectMemberIds,
  getUnreadCount,
  listActivity,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyUsers,
  recordProjectEvent,
};
