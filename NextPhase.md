# Feature Gap Analysis: CS687-CollabAgent

## Current Feature Set

The project already has a robust foundation with 5 AI agents operating within the AI Workbench (Knowledge/RAG, Task Orchestrator, Team Coordinator, Feedback Agent, Advisor Analyst), a Kanban task board with dependency graphs, project management, authentication, and RAG-powered document ingestion.

## Identified Feature Gaps

I categorized 10 potential features across impact, effort, and how well they fill existing gaps:

| Feature | Impact | Effort | Existing Infra |
|---------|--------|--------|----------------|
| **🔔 Notifications System** | **High** | **Medium** | Bell icon already in UI header |
| 💬 Task Comments / Discussion | High | Medium | Tasks table exists |
| 📄 Document Manager Page | High | Medium | RAG/KB already built |
| 📋 Activity Feed / Audit Log | Medium | Low | `activity_log` table exists in DB |
| 📅 Calendar / Timeline View | Medium | High | Task deadlines exist |
| 🔄 Real-time WebSocket Sync | Very High | High | EventSource for RAG exists |
| 🔍 Global Search | Medium | Medium | No existing infra |
| ⚙️ User Settings Page | Low | Low | API endpoints exist |
| 📤 PDF/Report Export | Medium | Medium | Report generation exists |
| 🔌 Webhook/Integration System | Medium | Very High | No existing infra |

## 🏆 Top Recommendation: **Notifications System**

**Why this is the best next feature:**

1. **The Bell icon already exists** in the AI Workbench header (line 868 of AIWorkbench.jsx) — users expect it to work
2. **Self-contained implementation** — new DB table, a few API routes, one frontend component (notification dropdown/panel)
3. **High user impact** — notifications keep team members in sync across task assignments, feedback responses, project updates
4. **Can start simple (polling/SSE)** and upgrade to WebSockets later
5. **Cross-cutting** — spans tasks, feedback, project members, and agent activity

**What it would include:**
- `notifications` DB table (user_id, type, title, body, link, is_read, created_at)
- Backend: `POST /api/notifications` (create), `GET /api/notifications` (list for user), `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`
- Backend hooks to auto-create notifications on: task assignment, feedback submission, project member add
- Frontend: Notification dropdown/bell badge with unread count, notification panel page, read/unread state
- Real-time updates via Server-Sent Events (matching the existing RAG event pattern)

**Second Recommendation: Activity Feed / Audit Log** (low effort, the DB table already exists in `migrate.js`) — this could be bundled with notifications as both serve the "keeping teams in sync" goal.


# What to implement

## 1. Notifications System:

- Notification creation, storage, and retrieval (per-user)
- Real-time or near-real-time delivery (use the pattern already established in the codebase — WebSockets, polling, SSE, or push — whichever fits)
- Marking notifications as read (individually and bulk)
- Notification types/categories (e.g., mentions, system alerts, updates) with extensible structure
- Notification bell/indicator in the UI with unread count badge
- Notification dropdown or panel listing recent notifications

## 2. Activity Feed (companion feature):
- Chronological feed of actions/events scoped to a user or entity (e.g., project, team)
- Activity entries generated from relevant user or system actions
- Feed rendering in the UI with appropriate grouping or pagination

### Implementation requirements
- Follow existing patterns for API routes, data models, state management, and component structure
- Ensure proper error handling and loading states throughout
- Write any database migrations needed
- Keep the notification and activity data models extensible for future event types
- Secure all endpoints — only authenticated users can access their own notifications and feed
- Production-ready quality: Include comprehensive error handling, unit and integration tests, real-time delivery implementation, and documentation (inline comments and a brief README covering setup, architecture, and key design decisions)

# What had implemented

Implemented the notifications system and activity feed end to end.

Key pieces:
- Backend schema/migrations in [backend/db/migrate.js](./backend/db/migrate.js) and [backend/db/migrate_notifications.js](./backend/db/migrate_notifications.js)
- Notification/activity service in [backend/services/notificationService.js](./backend/services/notificationService.js)
- Authenticated REST + SSE APIs in [backend/routes/notifications.js](./backend/routes/notifications.js)
- Event emission from project/task actions in [backend/routes/projects.js](./backend/routes/projects.js) and [backend/routes/tasks.js](./backend/routes/tasks.js)
- Frontend notification state/SSE provider, bell dropdown, and activity feed in [frontend/src/context/NotificationContext.jsx](./frontend/src/context/NotificationContext.jsx), [frontend/src/components/NotificationBell.jsx](./frontend/src/components/NotificationBell.jsx), and [frontend/src/components/ActivityFeed.jsx](./frontend/src/components/ActivityFeed.jsx)
- Project overview now renders persisted project activity.
- README documentation added under “Notifications And Activity Feed”.
- Backend unit tests added in [backend/test/notifications.test.js](./backend/test/notifications.test.js)

Verification:
- `npm run db:migrate` passed.
- `cd backend && npm test` passed: 3/3 tests.
- `cd frontend && npm run build` passed. It still reports existing unrelated warnings in `NewProjectModal.jsx`, `LandingPage.jsx`, and `LoginPage.jsx`.
- Browser smoke-tested the dashboard and notification dropdown; fixed sidebar clipping during that pass.

The dev servers are running:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
