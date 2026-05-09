# CS687-CollabAgent — Intelligent Research Teams

A full-stack AI research collaboration platform built with **React.js** (frontend) and **Node.js + Express.js + PostgreSQL** (backend).

---

## 📁 Project Structure

```
CS687-CollabAgent/
├── frontend/               # React.js app (Create React App)
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
│
├── backend/                # Node.js + Express API
│   ├── config/
│   │   └── database.js
│   ├── db/
│   │   └── migrate.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── projects.js
│   │   └── users.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
├── package.json            # Root scripts (runs both apps)
└── README.md
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

CLIENT_URL=http://localhost:3000
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
