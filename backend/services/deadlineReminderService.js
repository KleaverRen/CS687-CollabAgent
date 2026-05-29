const cron = require("node-cron");
const pool = require("../config/database");
const { notifyUsers } = require("./notificationService");

/**
 * Deadline Reminder Service
 *
 * Periodically checks for tasks whose deadlines are approaching and
 * sends reminder notifications to the assigned user and project members.
 *
 * Reminder windows:
 *   - 2 days before deadline  → "Upcoming deadline" reminder
 *   - 1 day before deadline   → "Urgent deadline" reminder
 *   - Same day                → "Deadline today" reminder
 *   - Past deadline (not done) → "Overdue" alert
 */

const REMINDER_WINDOWS = [
  {
    label: "2 days",
    startInterval: "1 day 23 hours",
    endInterval: "2 days",
    direction: "future",
    type: "deadline.upcoming",
    titleTemplate: (taskTitle) => `⏰ Deadline in 2 days: ${taskTitle}`,
    bodyTemplate: (taskTitle) =>
      `The task "${taskTitle}" is due in approximately 2 days. Please plan your work accordingly.`,
    priority: "normal",
  },
  {
    label: "1 day",
    startInterval: "23 hours",
    endInterval: "1 day",
    direction: "future",
    type: "deadline.urgent",
    titleTemplate: (taskTitle) => `🔔 Deadline tomorrow: ${taskTitle}`,
    bodyTemplate: (taskTitle) =>
      `The task "${taskTitle}" is due tomorrow. Please prioritize completing it.`,
    priority: "high",
  },
  {
    label: "today",
    startInterval: "0",
    endInterval: "12 hours", // next 12 hours
    direction: "future",
    type: "deadline.today",
    titleTemplate: (taskTitle) => `🚨 Deadline today: ${taskTitle}`,
    bodyTemplate: (taskTitle) =>
      `The task "${taskTitle}" is due today. Please ensure it is completed.`,
    priority: "high",
  },
  {
    label: "overdue",
    startInterval: "0",
    endInterval: "7 days", // up to 7 days overdue
    direction: "past",
    type: "deadline.overdue",
    titleTemplate: (taskTitle) => `❌ Overdue: ${taskTitle}`,
    bodyTemplate: (taskTitle) =>
      `The task "${taskTitle}" is overdue. Please take immediate action.`,
    priority: "critical",
  },
];

/**
 * Check if we already sent a reminder for this task + window in the
 * current reminder cycle (within the last 20 hours to avoid duplicates).
 */
async function alreadyNotified(taskId, reminderType) {
  const result = await pool.query(
    `SELECT 1
     FROM notifications
     WHERE entity_id = $1
       AND type = $2
       AND created_at > NOW() - INTERVAL '20 hours'
     LIMIT 1`,
    [taskId, reminderType],
  );
  return result.rowCount > 0;
}

/**
 * Find tasks whose deadlines fall within a given interval from now.
 *
 * For "upcoming/urgent/today" reminders, we look for deadlines in the
 * future within the window.
 * For "overdue", we look for deadlines in the past.
 */
async function findTasksInWindow(window) {
  const lowerBound =
    window.direction === "past"
      ? `NOW() - $2::interval`
      : `NOW() + $1::interval`;
  const upperBound =
    window.direction === "past"
      ? `NOW() - $1::interval`
      : `NOW() + $2::interval`;

  const result = await pool.query(
    `SELECT
       t.id,
       t.title,
       t.deadline,
       t.assigned_to,
       t.project_id,
       t.status,
       u.full_name AS assignee_name,
       p.name      AS project_name
     FROM tasks t
     LEFT JOIN users   u ON t.assigned_to = u.id
     LEFT JOIN projects p ON t.project_id = p.id
     WHERE t.deadline IS NOT NULL
       AND COALESCE(LOWER(TRIM(t.status)), '') <> 'done'
       AND t.deadline >= ${lowerBound}
       AND t.deadline <= ${upperBound}`,
    [window.startInterval, window.endInterval],
  );
  return result.rows;
}

/**
 * Send deadline reminder notifications for a given window.
 */
async function processWindow(window) {
  const tasks = await findTasksInWindow(window);
  let sent = 0;

  for (const task of tasks) {
    // Skip if no one is assigned
    if (!task.assigned_to) continue;

    // Avoid duplicate notifications within 20 hours
    if (await alreadyNotified(task.id, window.type)) continue;

    const title = window.titleTemplate(task.title);
    const body = window.bodyTemplate(task.title);
    const actionUrl = `/projects/${task.project_id}/tasks`;

    // Notify the assigned user
    await notifyUsers([task.assigned_to], {
      actorId: null,
      projectId: task.project_id,
      entityType: "task",
      entityId: task.id,
      type: window.type,
      category: "deadlines",
      title,
      body,
      actionUrl,
      skipActor: false,
      metadata: {
        deadline: task.deadline,
        projectName: task.project_name,
        assigneeName: task.assignee_name,
        reminderWindow: window.label,
      },
    });

    sent++;
  }

  return sent;
}

/**
 * Main check function — processes all reminder windows.
 */
async function checkDeadlines() {
  console.log("[DeadlineReminder] 🔍 Checking for approaching deadlines...");

  let totalSent = 0;
  for (const window of REMINDER_WINDOWS) {
    const count = await processWindow(window);
    if (count > 0) {
      console.log(
        `[DeadlineReminder] 📬 Sent ${count} reminder(s) for "${window.label}" window`,
      );
    }
    totalSent += count;
  }

  if (totalSent === 0) {
    console.log("[DeadlineReminder] ✅ No deadline reminders to send.");
  } else {
    console.log(
      `[DeadlineReminder] ✅ Total deadline reminders sent: ${totalSent}`,
    );
  }
}

let scheduledTask = null;

/**
 * Start the deadline reminder cron scheduler.
 *
 * Default schedule: runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00 …)
 * Can be overridden via DEADLINE_CRON env variable.
 */
function startScheduler(cronExpression) {
  const expression = cronExpression || process.env.DEADLINE_CRON || "0 * * * *";

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(expression, () => {
    checkDeadlines().catch((err) => {
      console.error("[DeadlineReminder] ❌ Error during deadline check:", err);
    });
  });

  console.log(
    `[DeadlineReminder] ⏰ Scheduler started with cron: "${expression}"`,
  );

  return scheduledTask;
}

/**
 * Stop the scheduler (useful for graceful shutdown).
 */
function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[DeadlineReminder] ⏹️  Scheduler stopped.");
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  checkDeadlines,
  findTasksInWindow,
  REMINDER_WINDOWS,
};
