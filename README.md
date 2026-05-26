# CS687-CollabAgent — Intelligent Research Teams

A full-stack AI research collaboration platform built with **React.js** (frontend) and **Node.js + Express.js + PostgreSQL** (backend).

---

## 📁 Project Structure

```
📁 CS687-CollabAgent/
├── 📁 frontend/               # React.js app (Create React App)
│   ├── 📁 public
│   └── 🌐 index.html
│   ├── 📁 src
│   │   ├── 📁 components
│   │   │   ├── 📄 AISuggestionDrawer.jsx
│   │   │   ├── 📄 AffinityScorer.jsx
│   │   │   ├── 📄 DependencyGraph.jsx
│   │   │   ├── 📄 Layout.jsx
│   │   │   ├── 📄 NewProjectModal.jsx
│   │   │   ├── 📄 ProjectCard.jsx
│   │   │   ├── 📄 ProtectedRoute.jsx
│   │   │   ├── 📄 Sidebar.jsx
│   │   │   └── 📄 TaskCard.jsx
│   │   ├── 📁 context
│   │   │   ├── 📄 AuthContext.jsx
│   │   │   └── 📄 TaskContext.jsx
│   │   ├── 📁 pages
│   │   │   ├── 📄 AgentLogs.jsx
│   │   │   ├── 📄 Dashboard.jsx
│   │   │   ├── 📄 LandingPage.jsx
│   │   │   ├── 📄 LoginPage.jsx
│   │   │   ├── 📄 ProjectOverview.jsx
│   │   │   ├── 📄 ProjectsDirectory.jsx
│   │   │   ├── 📄 RegisterPage.jsx
│   │   │   └── 📄 TaskBoard.jsx
│   │   ├── 📁 utils
│   │   │   └── 📄 api.js
│   │   ├── 📄 App.jsx
│   │   ├── 🎨 index.css
│   │   └── 📄 index.js
│   ├── ⚙️ package-lock.json
│   ├── ⚙️ package.json
│   └── 📄 tailwind.config.js
│
├── 📁 backend/                # Node.js + Express API
│   ├── 📁 config
│   │   └── 📄 database.js
│   ├── 📁 db
│   │   ├── 📄 dump.sql
│   │   ├── 📄 migrate.js
│   │   ├── 📄 migrate_tasks.js
│   │   └── 📄 seed.js
│   ├── 📁 middleware
│   │   ├── 📄 agentGate.js
│   │   └── 📄 auth.js
│   ├── 📁 routes
│   │   ├── 📁 agents
│   │   │   ├── 📄 coordination.js
│   │   │   ├── 📄 feedback.js
│   │   │   ├── 📄 progress.js
│   │   │   └── 📄 task.js
│   │   ├── 📄 ai_suggestions.js
│   │   ├── 📄 auth.js
│   │   ├── 📄 projects.js
│   │   ├── 📄 rag.js
│   │   ├── 📄 tasks.js
│   │   └── 📄 users.js
│   ├── 📁 services
│   │   ├── 📄 documentService.js
│   │   ├── 📄 embeddingService.js
│   │   ├── 📄 eventBroker.js
│   │   ├── 📄 generationService.js
│   │   └── 📄 vectorStorage.js
│   ├── 📁 test
│   │   └── 📄 test_rag.js
│   ├── ⚙️ .env.example
│   ├── ⚙️ package-lock.json
│   ├── ⚙️ package.json
│   └── server.js
│
├── ⚙️ package.json            # Root scripts (runs both apps)
└── 📄 README.md
```

---

## ⚙️ Prerequisites

- **Node.js** v18+ (`node --version`)
- **npm** v9+ (`npm --version`)
- **PostgreSQL** v14+ (`psql --version`)

---

## 🚀 Setup & Run Commands

### Step 1 — Clone / navigate to the project
```bash
cd CS687-CollabAgent
```

### Step 2 — Install all dependencies
```bash
# Install root + backend + frontend dependencies in one command:
npm run install:all

# Or manually:
npm install                         # root (concurrently)
cd backend && npm install           # backend deps
cd ../frontend && npm install       # frontend deps
```

### Step 3 — Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=collabagent_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

JWT_SECRET=your_super_secret_key_min_32_characters_long
JWT_EXPIRES_IN=7d

OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_URL=http://localhost:3000
```

🔑 **Obtaining Cloud API Keys (Free Tiers):**
CollabAgent uses Groq and Google Gemini cloud models for orchestration and heavy processing. You can obtain free developer API keys here:

- **Gemini API Key**
  1. Visit [Google AI Studio](https://aistudio.google.com/).
  2. Log in with your standard Google account.  
  3. Click the prominent Get API key button (usually in the top left or top navigation bar).  
  4. Click Create API Key.
  5. You will be prompted to associate it with a Google Cloud project. If you don't have one, just select Create key in new project.  
  6. Copy your generated key.

- **Groq API Key**
  1. Go to the [Groq Cloud Console](https://console.groq.com/).
  2. Sign up for an account (or log in if you already have one).  
  3. In the left-hand sidebar or menu, click on API Keys.  
  4. Click the Create API Key button.  
  5. Give your key a descriptive name (e.g., "collabagent-dev") and click Submit.  
  6. Copy the key immediately before closing the window. 

🦙 **Setting up local fallback (Ollama):**

CollabAgent uses Ollama as the default local model provider. Install and start it before using RAG generation:
```bash
brew install ollama
brew services start ollama
ollama pull llama3.2
```
**Troubleshooting Database Credentials:**
If you are unsure of your `DB_USER` or `DB_PASSWORD`, you can set up or reset the default `postgres` user by following these steps:

1. **Check if the `postgres` user exists:**
   ```bash
   psql -U postgres -c "\du"
   ```
   *Note: If you get an access error, try `sudo -u postgres psql` or check your current system user with `whoami`.*

2. **Create the `postgres` user (if missing):**
   ```bash
   createuser -P postgres
   ```

3. **Set or update the password:**
   ```bash
   psql -U postgres -c "ALTER USER postgres PASSWORD 'your_postgres_password';"
   ```

**Generating a JWT Secret:**
If `JWT_SECRET` is missing, you can securely generate a random 32-character base64 string using OpenSSL:
```bash
openssl rand -base64 32
```

### Step 4 — Set up PostgreSQL database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE collabagent_db;"

# Run migrations (creates all tables)
npm run db:migrate
```

### Step 5 — Start the development servers

```bash
# Run BOTH frontend and backend simultaneously (recommended):
npm run dev

# Or run separately in two terminals:
npm run dev:backend    # Terminal 1 → http://localhost:5000
npm run dev:frontend   # Terminal 2 → http://localhost:3000
```

---

## 🌐 Access the App

| Service          | URL                              |
|-----------------|----------------------------------|
| Frontend (React) | http://localhost:3000            |
| Backend API      | http://localhost:3001            |
| Health check     | http://localhost:3001/health     |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint              | Description          | Auth |
|--------|-----------------------|----------------------|------|
| POST   | /api/auth/register    | Create account       | ❌   |
| POST   | /api/auth/login       | Login                | ❌   |
| GET    | /api/auth/me          | Get current user     | ✅   |
| POST   | /api/auth/logout      | Logout               | ✅   |

### Projects
| Method | Endpoint              | Description          | Auth |
|--------|-----------------------|----------------------|------|
| GET    | /api/projects         | List projects        | ✅   |
| POST   | /api/projects         | Create project       | ✅   |
| GET    | /api/projects/:id     | Get project          | ✅   |
| PATCH  | /api/projects/:id     | Update project       | ✅   |
| DELETE | /api/projects/:id     | Delete project       | ✅   |

### Users
| Method | Endpoint                    | Description          | Auth |
|--------|-----------------------------|----------------------|------|
| GET    | /api/users/profile          | Get profile          | ✅   |
| PATCH  | /api/users/profile          | Update profile       | ✅   |
| PATCH  | /api/users/password         | Change password      | ✅   |
| GET    | /api/users/dashboard-stats  | Get stats            | ✅   |

---

## 🗄️ Database Schema

- **users** — Full profiles with roles (researcher, project_lead, faculty, student)
- **sessions** — JWT session tracking
- **projects** — Research projects with visibility settings
- **project_members** — Many-to-many: users ↔ projects
- **agents** — AI agents per project
- **documents** — Knowledge base files with indexing status

---

## 🏗️ Production Build

```bash
# Build the React frontend for production
npm run build:frontend
# Output: frontend/build/

# Start backend in production
cd backend
NODE_ENV=production node server.js
```

---

## AI Workbench

### Overview

The AI Workbench is a multi-agent orchestration hub where specialized AI agents collaborate to accelerate research project management. Each agent is designed for a distinct workflow — from ingesting knowledge and managing tasks to coordinating teams and analyzing progress. Agents can be selected from the sidebar, and you interact with them through a shared message composer. The right panel (Advisor View) provides an executive summary of project health.

### Knowledge Agent

The **Knowledge Agent** (powered by RAG — Retrieval-Augmented Generation) ingests research documents into a vector index and answers questions by retrieving relevant chunks from the indexed knowledge base. It supports OLLama, Groq, and Gemini as backend providers.

**Capabilities:**
- Index project documentation, research papers, and notes by title and content
- Query the indexed knowledge base with natural language questions
- See retrieved source snippets alongside the generated answer
- Stream ingestion events in real time

Example prompts:

```
What are the key findings from our Phase 1 experiments?
```
```
Summarize the methodology described in the research proposal.
```
```
Index this meeting notes document and tell me what action items were discussed.
```
```
Compare our approach to the baseline method mentioned in the literature review.
```

---

### Task Orchestrator

The **Task Orchestrator** converts natural language requests into structured project tasks. It supports single-task creation, bulk task breakdown from project plans, and updates to existing todo tasks (assignee reassignment, deadline changes).

**Capabilities:**
- Parse a single natural language request into a task draft (title, priority, assignee)
- Generate a comprehensive task breakdown (10–16 tasks) from a high-level project planning request
- Update existing todo tasks: reassign team members, set or change deadlines
- Confirm drafts to commit them to the database

Example prompts that should now work in the Task Orchestrator:

```
Create a task "Integration Testing" with high priority.
```
```
Assign the todo task "Integration Testing" to me.
```
```
Set the deadline for "AI Suggestion Engine" to Friday.
```
```
Assign the existing task "Integration Testing" to Priya Nair and set the deadline to 2026-06-01.
```
```
Generate a comprehensive task breakdown for Phase 2 of the research project covering architecture, implementation, and testing workstreams.
```
```
Update the "API Documentation" task deadline to next Monday and assign it to Alex Chen.
```
```
Create a new task "Write final report" due by 12/15.
```

---

### Team Coordinator

The **Team Coordinator** processes meeting transcripts to extract structured summaries, action items, and ownership assignments. It logs cross-agent activity, creating a persistent history of team events — including task assignments, document indexing, and feedback submissions.

**Capabilities:**
- Summarize meeting transcripts into 2–3 sentence executive summaries
- Extract action items with priority levels and assignee names
- Convert extracted action items into confirmable task drafts
- Maintain an audit trail of all team activities via an event broker

Example prompts:

```
Summarize this standup: "Alice completed the data pipeline. Bob is blocked on API integration. Carol started the UI mockups. We need a design review by Wednesday."
```
```
Extract action items from this sprint retro transcript: "We agreed to move the deployment to staging. Dave will draft a testing plan. Sarah will update the project timeline."
```
```
Log this activity: Team sync completed — all blockers resolved and milestones are on track.
```

---

### Feedback Agent

The **Feedback Agent** ingests advisor or peer review feedback, categorizes it by severity (low, medium, high, urgent), generates a one-sentence structured summary, and drafts a professional response template that students can use to reply. It also maintains a persistent feedback dashboard of open/unresolved items.

**Capabilities:**
- Classify feedback by severity level
- Generate a concise 1-sentence structured summary of the main critique
- Draft a polite, professional response template with placeholders
- Allow students to respond and advisors to resolve feedback threads

Example prompts:

```
"Your analysis lacks statistical rigor. The sample size is too small to draw meaningful conclusions, and you haven't justified your choice of model. I recommend adding a power analysis and comparing at least two alternative models."
```
```
"The project timeline is unrealistic given the scope of work. You need to either cut features or extend the deadline by at least two weeks."
```
```
"The documentation is well-structured and the code is clean. However, the test coverage is below 60% and needs to be improved before the final submission."
```

---

### Advisor Analyst

The **Advisor Analyst** (also called the Progress Monitoring Agent) generates a professional three-paragraph Markdown progress report for project stakeholders. It collects real-time metrics — task completion percentage, open feedback count, weekly activity velocity, and active risks — and synthesizes them into an executive summary with risk assessment and recommendations.

**Capabilities:**
- Query aggregated project health metrics (completion %, feedback count, weekly velocity)
- Auto-generate risks from high-severity feedback submissions
- Produce an advisor-ready Markdown report with executive summary, velocity section, and risk assessment
- Edit generated reports inline before export

Example prompts:

```
Generate a weekly progress report for the advisor meeting tomorrow.
```
```
Pull the latest dashboard metrics and highlight any blockers or at-risk milestones.
```
```
Show me the current task completion rate and open feedback count.
```
```
What are the active risks in this project and what's the recommended mitigation?
```

---
## Notifications And Activity Feed

CollabAgent includes an authenticated notification system plus a project-scoped activity feed.

**Architecture:**
- `notifications` stores per-user notification records with `type`, `category`, optional entity references, `action_url`, metadata, and `read_at`.
- `activity_log` is the canonical project activity timeline. It supports event types, entity references, metadata, and project/user visibility checks.
- `backend/services/notificationService.js` centralizes creation, read-state updates, project event recording, and pagination.
- `GET /api/notifications/stream` uses Server-Sent Events for near-real-time delivery. The client passes the JWT as a query token because browser `EventSource` cannot set authorization headers.
- `frontend/src/context/NotificationContext.jsx` owns notification state, unread count, read mutations, and the SSE lifecycle.
- `NotificationBell` renders the unread badge and recent notification dropdown. `ActivityFeed` renders paginated project activity.

**Setup:**
1. Run `npm run db:migrate` from the repo root, or `cd backend && node db/migrate_notifications.js` if the base schema already exists.
2. Start the backend and frontend with `npm run dev`.
3. Sign in and perform collaboration actions such as assigning a student or assigning a task. The recipient sees a notification badge, and the project overview shows the activity entry.

**Key design decisions:**
- SSE was chosen to match the existing Express/event-broker style without introducing a WebSocket server.
- Notifications are targeted to users; activity entries are scoped to projects and checked against project membership/ownership before being returned.
- Event payloads use string `type`/`category` values and JSON metadata so new event families can be added without schema churn.
- Read endpoints update only the authenticated user's rows.

---
## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, React Router v6, Tailwind CSS, Axios, React Hot Toast |
| Backend    | Node.js, Express.js, JWT, bcryptjs  |
| Database   | PostgreSQL, node-postgres (pg)      |
| Security   | Helmet, CORS, Rate Limiting, Input Validation |
