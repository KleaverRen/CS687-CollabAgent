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

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, React Router v6, Tailwind CSS, Axios, React Hot Toast |
| Backend    | Node.js, Express.js, JWT, bcryptjs  |
| Database   | PostgreSQL, node-postgres (pg)      |
| Security   | Helmet, CORS, Rate Limiting, Input Validation |
