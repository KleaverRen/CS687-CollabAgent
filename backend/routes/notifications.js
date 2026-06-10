const express = require("express");
const router = express.Router();
const { body, query, param, validationResult } = require("express-validator");
const { authenticate, authenticateSSE } = require("../middleware/auth");
const eventBroker = require("../services/eventBroker");
const {
  createNotification,
  getUnreadCount,
  listActivity,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../services/notificationService");
const { checkDeadlines } = require("../services/deadlineReminderService");

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

router.get(
  "/",
  authenticate,
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("before").optional().isISO8601(),
    query("unread").optional().isBoolean(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const notifications = await listNotifications(req.user.id, {
        limit: req.query.limit,
        before: req.query.before,
        unreadOnly: req.query.unread === "true",
      });
      const unreadCount = await getUnreadCount(req.user.id);
      res.json({ notifications, unreadCount });
    } catch (err) {
      console.error("[Notifications] List error:", err);
      res.status(500).json({ error: "Failed to load notifications" });
    }
  },
);

router.post(
  "/",
  authenticate,
  [
    body("type").trim().notEmpty().withMessage("type is required"),
    body("title").trim().notEmpty().withMessage("title is required"),
    body("body").optional({ nullable: true }).isString(),
    body("link").optional({ nullable: true }).isString(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const notification = await createNotification({
        userId: req.user.id,
        actorId: req.user.id,
        type: req.body.type,
        category: req.body.category || "updates",
        title: req.body.title,
        body: req.body.body || "",
        link: req.body.link || null,
        metadata: req.body.metadata || {},
      });
      res.status(201).json({
        notification,
        unreadCount: await getUnreadCount(req.user.id),
      });
    } catch (err) {
      console.error("[Notifications] Create error:", err);
      res.status(500).json({ error: "Failed to create notification" });
    }
  },
);

router.get("/unread-count", authenticate, async (req, res) => {
  try {
    res.json({ unreadCount: await getUnreadCount(req.user.id) });
  } catch (err) {
    console.error("[Notifications] Count error:", err);
    res.status(500).json({ error: "Failed to load unread count" });
  }
});

router.patch(
  "/:id/read",
  authenticate,
  [param("id").isUUID()],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const notification = await markNotificationRead(
        req.user.id,
        req.params.id,
      );
      if (!notification)
        return res.status(404).json({ error: "Notification not found" });
      res.json({
        notification,
        unreadCount: await getUnreadCount(req.user.id),
      });
    } catch (err) {
      console.error("[Notifications] Mark read error:", err);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  },
);

router.patch("/read-all", authenticate, async (req, res) => {
  if (!handleValidation(req, res)) return;

  try {
    const updated = await markAllNotificationsRead(req.user.id);
    res.json({ updated, unreadCount: 0 });
  } catch (err) {
    console.error("[Notifications] Mark all read error:", err);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

router.post("/read-all", authenticate, async (req, res) => {
  try {
    const updated = await markAllNotificationsRead(req.user.id);
    res.json({ updated, unreadCount: 0 });
  } catch (err) {
    console.error("[Notifications] Mark all read error:", err);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

router.get("/stream", authenticateSSE, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  req.socket?.setKeepAlive?.(true);

  const write = (eventName, payload) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const topic = `notifications.user.${req.user.id}`;
  let cachedUnreadCount = null;

  const getCachedUnreadCount = async () => {
    if (typeof cachedUnreadCount === "number") {
      return cachedUnreadCount;
    }
    cachedUnreadCount = await getUnreadCount(req.user.id);
    return cachedUnreadCount;
  };

  const getFreshUnreadCount = async () => {
    cachedUnreadCount = await getUnreadCount(req.user.id);
    return cachedUnreadCount;
  };

  const listener = async (event) => {
    try {
      const unreadCount =
        typeof event.payload.unreadCount === "number"
          ? event.payload.unreadCount
          : await getCachedUnreadCount();

      if (typeof event.payload.unreadCount === "number") {
        cachedUnreadCount = event.payload.unreadCount;
      }

      write("notification", {
        ...event.payload,
        unreadCount,
      });
    } catch (err) {
      console.error("[Notifications] SSE listener error:", err);
      write("notification", {
        ...event.payload,
        unreadCount:
          typeof cachedUnreadCount === "number" ? cachedUnreadCount : null,
      });
    }
  };

  res.write("retry: 5000\n\n");
  write("ready", { unreadCount: await getCachedUnreadCount() });
  eventBroker.on(topic, listener);

  const heartbeat = setInterval(async () => {
    try {
      write("heartbeat", {
        at: new Date().toISOString(),
        unreadCount: await getFreshUnreadCount(),
      });
    } catch (err) {
      console.error("[Notifications] SSE heartbeat error:", err);
    }
  }, 10000);

  req.on("close", () => {
    clearInterval(heartbeat);
    eventBroker.removeListener(topic, listener);
    res.end();
  });
});

router.get(
  "/activity",
  authenticate,
  [
    query("project_id").optional().isUUID(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("before").optional().isISO8601(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const activities = await listActivity(req.user.id, {
        projectId: req.query.project_id,
        limit: req.query.limit,
        before: req.query.before,
      });
      res.json({ activities });
    } catch (err) {
      console.error("[Notifications] Activity list error:", err);
      res.status(500).json({ error: "Failed to load activity feed" });
    }
  },
);

/**
 * POST /api/notifications/check-deadlines
 * Manually trigger a deadline reminder check (for testing).
 * Only available in non-production environments.
 */
router.post("/check-deadlines", authenticate, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(403)
      .json({ error: "Manual deadline check not available in production" });
  }

  try {
    await checkDeadlines();
    const unreadCount = await getUnreadCount(req.user.id);
    res.json({
      message: "Deadline check completed",
      unreadCount,
    });
  } catch (err) {
    console.error("[Notifications] Deadline check error:", err);
    res.status(500).json({ error: "Failed to run deadline check" });
  }
});

module.exports = router;
