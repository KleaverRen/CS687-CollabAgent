# CollabAgent Product Demonstration Guide

## Purpose

This guide provides a presenter-ready, step-by-step demonstration for **CollabAgent**, a multi-agent AI workbench and autonomous orchestration framework. It is written for developers, stakeholders, and potential users who want to see how specialized AI agents collaborate in real time to solve complex project work.

The demo highlights three core product messages:

1. CollabAgent is a **multi-agent workbench**, not a single chatbot.
2. Agent outputs become real project state: indexed documents, structured tasks, persistent notifications, activity logs, and reports.
3. The system combines **Gemini** for heavier semantic/RAG reasoning with **Groq** for fast orchestration-style interactions.

> **What to say:** "CollabAgent turns a project workspace into an agent-assisted operating environment. The agents do not just answer questions; they read project context, propose structured work, ask for human confirmation before mutations, and push real-time status back into the UI."

## System Overview

### Architecture

CollabAgent uses a multi-agent framework with specialized agents:

- **Knowledge Agent:** indexes project documents and answers questions with retrieval-augmented generation.
- **Task Orchestrator:** converts natural language into tasks, updates existing tasks, and generates multi-task backlogs.
- **Team Coordinator:** summarizes meetings, extracts action items, and logs collaboration events.
- **Feedback Agent:** captures advisor or peer feedback, classifies severity, and drafts responses.
- **Advisor Analyst:** synthesizes project health, risks, activity, and recommendations into progress reports.

### Core Stack

- **Frontend:** React UI with AI Workbench, Document Manager, Task Board, Team Hub, Agent Logs, and notification components.
- **Backend:** Node.js and Express API routes for auth, projects, documents, tasks, RAG, notifications, and agent workflows.
- **Database:** PostgreSQL stores users, projects, project membership, documents, task state, notifications, workbench sessions, messages, and activity logs.
- **AI and Orchestration:** Gemini APIs support deeper semantic reasoning and RAG synthesis; Groq APIs support low-latency orchestration and fast structured outputs.
- **Knowledge Layer:** PDF, DOCX, and TXT files are extracted, chunked, embedded, and indexed for semantic retrieval.
- **Real-Time Layer:** Server-Sent Events (SSE) stream persistent notifications and live agent/document status updates to the React UI.

## Narrative Scenario

### Scenario: Onboarding a Multi-Agent Research Prototype

The presenter is a project lead onboarding a team to **Phase 1: Multi-Agent System Deployment Plan**. The team needs to understand the project plan, turn it into work, assign responsibilities, respond to advisor feedback, and generate a stakeholder-ready progress summary.

The demo intentionally forces agents to interact:

1. The **Knowledge Agent** ingests the deployment plan.
2. The **Task Orchestrator** uses that context to create a backlog.
3. The **Notification system** shows real-time task assignment via SSE.
4. The **Team Coordinator** converts meeting notes into follow-up work.
5. The **Feedback Agent** records advisor concerns as structured risk.
6. The **Advisor Analyst** produces a progress report from the accumulated project state.
7. **Agent Logs** show the audit trail across the workflow.

> **What to say:** "This scenario shows the agents collaborating around shared project state. Knowledge becomes tasks, tasks become notifications, feedback becomes risk, and the final report reflects the work that happened during the demo."

## Pre-Demo Setup

### 1. Start the Application

From the repository root:

```bash
npm run db:migrate
npm run dev
```

Expected local services:

- React frontend: `http://localhost:3000`
- Express backend: `http://localhost:3001`
- Backend health check: `http://localhost:3001/health`

### 2. Confirm Environment Variables

Confirm `backend/.env` includes the required database, auth, and AI provider configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=collabagent_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_super_secret_key_min_32_characters_long
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_URL=http://localhost:3000
```

Optional local fallback:

```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### 3. Prepare Demo Accounts

Use two browser sessions if possible:

- **Presenter session:** logged in as a student or project member.
- **Recipient session:** logged in as another project member in the same project.

This makes the SSE notification moment visible without refreshing the page.

### 4. Prepare Demo Document Content

Use this document for predictable RAG and task-generation results:

```text
Project Goal: Deploy a Multi-Agentic AI framework in the Data Science division.

Workstreams for Phase 1:
1. Use Case & Agent Role Definition: Identify bottlenecks in EDA, reporting, and stakeholder handoffs.
2. Technical Feasibility: Evaluate LangGraph, AutoGen, Gemini, Groq, and local fallback models.
3. Data Readiness: Audit Snowflake access patterns, document availability, and PII redaction requirements.
4. ROI & Risk: Estimate token costs, latency requirements, hallucination risks, agent loop risks, and human approval controls.

Phase 1 success metrics:
- Produce a responsibility matrix for specialized agents.
- Demonstrate RAG over project planning documents.
- Generate a task backlog from indexed project knowledge.
- Show real-time notifications when tasks are assigned.
```

## Step-by-Step Walkthrough

## Step 1: Open the Project Workspace

### User Action

1. Open `http://localhost:3000`.
2. Log in.
3. Navigate to **Projects**.
4. Open or create a project named **MAS Deployment Pilot**.
5. From the project sidebar, open **AI Workbench**.

### Behind the Scenes

- React loads a protected project route.
- The frontend calls authenticated Express endpoints to fetch project context.
- AI Workbench restores session state from workbench session/message tables when available.
- The notification provider opens an SSE connection to `GET /api/notifications/stream` with browser credentials.

### What to Point Out

- The **AI Workbench** is the central command surface.
- The left/agent controls show specialized agents instead of one generic assistant.
- The notification area is already connected for live backend events.

> **What to say:** "Before any prompt is sent, the app has authenticated project context and a live notification stream. That is what lets agent actions become product events instead of isolated chat messages."

## Step 2: Show the Provider Strategy

### User Action

1. In **AI Workbench**, locate the provider selector.
2. Choose **Auto-Orchestrate** for the main demo.
3. Briefly show that **Groq** and **Gemini** can be selected directly.

### Behind the Scenes

- The selected provider is included in AI Workbench requests.
- **Auto-Orchestrate** allows the backend to pick the provider path for the task.
- Groq is appropriate for fast classification, routing, and structured orchestration.
- Gemini is appropriate for deeper semantic synthesis, especially over retrieved document context.

### What to Point Out

- Provider choice is visible and controllable.
- The same user workflow can run against different provider strategies.

> **What to say:** "The user does not need to manage every model call. CollabAgent can route automatically, while still exposing provider choice for testing, demos, cost control, and latency comparisons."

### Pro Tip

If a cloud key is missing, switch to another configured provider or local fallback. Explain that provider abstraction is intentional, while the product workflow remains the same.

## Step 3: Index Project Knowledge

### User Action

1. Select **Knowledge Agent**.
2. In **Index Project Document**, enter:

   **Document title**

   ```text
   Phase 1: Multi-Agent System Deployment Plan
   ```

   **Document content**

   ```text
   Project Goal: Deploy a Multi-Agentic AI framework in the Data Science division.

   Workstreams for Phase 1:
   1. Use Case & Agent Role Definition: Identify bottlenecks in EDA, reporting, and stakeholder handoffs.
   2. Technical Feasibility: Evaluate LangGraph, AutoGen, Gemini, Groq, and local fallback models.
   3. Data Readiness: Audit Snowflake access patterns, document availability, and PII redaction requirements.
   4. ROI & Risk: Estimate token costs, latency requirements, hallucination risks, agent loop risks, and human approval controls.

   Phase 1 success metrics:
   - Produce a responsibility matrix for specialized agents.
   - Demonstrate RAG over project planning documents.
   - Generate a task backlog from indexed project knowledge.
   - Show real-time notifications when tasks are assigned.
   ```

3. Click **Queue**.

### Behind the Scenes

- React posts the document to the RAG ingestion route.
- Express publishes a document ingestion event through the event broker.
- The backend extracts content, chunks it, creates embeddings, and indexes vectors.
- PostgreSQL stores document metadata and indexing status.
- SSE status events update the UI as ingestion progresses.

### What to Point Out

- The toast confirms the document was queued.
- Activity/status updates show the asynchronous pipeline.
- The document is becoming searchable project memory.

> **What to say:** "This is the Knowledge Management agent building shared memory. The document is not just uploaded; it is converted into indexed semantic chunks that other agents can retrieve."

### Pro Tip

If indexing takes a few seconds, narrate the pipeline: extraction, chunking, embedding, vector indexing, then retrieval readiness.

## Step 4: Ask a Grounded RAG Question

### User Action

1. Keep **Knowledge Agent** selected.
2. In the composer, type:

   ```text
   What is Phase 1 focused on, and what risks should we track?
   ```

3. Click **Send**.

### Behind the Scenes

- The frontend sends the query with project context and provider preference.
- The backend performs semantic search over the active project vector index.
- Retrieved chunks are passed into the generation service.
- Gemini can synthesize the answer when configured; fallback logic can still answer from retrieved context.
- The AI Workbench stores the exchange in session history.

### What to Point Out

- The answer should mention use case definition, technical feasibility, data readiness, ROI, hallucination risk, and agent loop risk.
- If source snippets appear, point to the document title and retrieved context.
- The answer is grounded in uploaded project knowledge.

> **What to say:** "The agent retrieves before it generates. That gives the team a grounded answer and gives developers a clear data path to inspect."

### Troubleshooting

If the answer is generic, wait for indexing to complete and retry. If the provider fails, switch providers and explain that retrieval and provider routing are separate layers.

## Step 5: Generate a Task Backlog from Knowledge

### User Action

1. Select **Task Orchestrator**.
2. Type:

   ```text
   Based on the Phase 1 MAS Deployment Plan documentation I just indexed, generate a comprehensive, actionable task list.

   Break it down by Use Case, Technical Feasibility, Data Readiness, and ROI & Risk.
   For each task, include a title, description, priority, complexity, and potential blocker.
   ```

3. Click **Send**.
4. Review the generated task list.
5. Click **Create All**.

### Behind the Scenes

- The Task Orchestrator detects that the request references documentation.
- The backend augments task generation with available project knowledge.
- Groq can help with fast structured orchestration; Gemini can help synthesize deeper RAG context.
- The first output is a draft.
- **Create All** sends a confirmed mutation with `user_confirmed: true`.
- `agentGate.js` enforces human confirmation before autonomous writes.
- Tasks are written to PostgreSQL and become visible on the Task Board.

### What to Point Out

- Generated tasks should include details from the document: LangGraph, AutoGen, Snowflake, PII redaction, token costs, hallucination risk, and agent loops.
- The UI separates draft generation from confirmed creation.
- CollabAgent creates real project work, not just recommendations.

> **What to say:** "This is the governance boundary. Agents can propose structured work automatically, but user confirmation is required before the system mutates project state."

### Pro Tip

Do not read every generated task. Point out the transformation: project plan language became structured, assignable work.

## Step 6: Demonstrate Real-Time Assignment via SSE

### User Action

1. Keep the presenter session in **AI Workbench**.
2. Open a second browser session as another project member.
3. In the presenter session, select **Task Orchestrator**.
4. Type:

   ```text
   Create a high priority task for API testing and assign it to Audrey Cooper.
   ```

5. Click **Send**.
6. Review the draft.
7. Click **Create Task**.
8. Watch the notification bell in the second browser session.

### Behind the Scenes

- The parse step creates a structured task draft.
- The confirm step calls `POST /api/agents/task/confirm` with `user_confirmed: true`.
- The backend persists the task in PostgreSQL.
- `notificationService.js` publishes a user-targeted notification through the event broker.
- `NotificationContext` receives it through `GET /api/notifications/stream`.
- The recipient UI updates without a page refresh.

### What to Point Out

- The assigned user receives a persistent notification in real time.
- The system uses SSE for server-to-client updates.
- One user's agent-assisted action creates visible collaborative state for another user.

> **What to say:** "This is where the agents become collaborative. The output of one user's workflow immediately becomes a live update for another teammate."

### Troubleshooting

If the notification does not appear:

- Confirm both users are members of the same project.
- Confirm the task is assigned to the recipient user.
- Refresh the recipient session to reconnect cookies/SSE.
- Confirm the backend is running at `http://localhost:3001`.

## Step 7: Convert Meeting Notes into Follow-Up Work

### User Action

1. Select **Team Coordinator**.
2. Paste:

   ```text
   Today we agreed that Ethan will review the generated task backlog, Audrey will evaluate LangGraph and AutoGen for orchestration, and Aaron will prepare the data governance checklist. The LangGraph evaluation is high priority because it affects the prototype architecture. The governance checklist is medium priority but must be ready before advisor review.
   ```

3. Click **Send**.
4. Review the summary and extracted action items.
5. Click **Create** or **Assign to Me** for one action item.

### Behind the Scenes

- The Team Coordinator processes unstructured meeting notes.
- The backend extracts summary, owners, priorities, and action items.
- Confirmed items can become project tasks.
- Coordination activity is logged through the event broker and persisted for auditability.

### What to Point Out

- The agent extracts ownership and priority from plain language.
- Meeting notes become structured execution items.
- Coordination events become part of the project record.

> **What to say:** "CollabAgent connects team conversation to execution. The meeting note becomes structured work, and the activity is retained for later reporting."

## Step 8: Capture Feedback as a Risk Signal

### User Action

1. Select **Feedback Agent**.
2. Set severity to **High**.
3. Paste:

   ```text
   The team needs to clarify success metrics for the multi-agent prototype and provide a stronger risk mitigation plan for hallucinations, unsafe tool use, and uncontrolled agent loops.
   ```

4. Click **Send**.

### Behind the Scenes

- The Feedback Agent records the feedback item.
- The backend classifies and summarizes the critique.
- The agent drafts a response template.
- High-severity feedback can surface as project risk for progress analysis.

### What to Point Out

- Feedback becomes structured state, not buried chat text.
- Severity, summary, and response draft are visible.
- This bridges advisor input and project execution.

> **What to say:** "Feedback becomes operational. The project can now track this as a risk and use it in reports and planning."

## Step 9: Generate an Advisor-Ready Progress Report

### User Action

1. Select **Advisor Analyst**.
2. Type:

   ```text
   Generate an advisor-ready weekly progress report that summarizes current progress, open risks, and recommended next steps.
   ```

3. Click **Send**.
4. Review the Markdown report.

### Behind the Scenes

- The Advisor Analyst pulls project health metrics from backend progress routes.
- The backend considers task completion, activity velocity, open feedback, and risks.
- A generation provider synthesizes the report into stakeholder-ready prose.
- The report appears in AI Workbench for review.

### What to Point Out

- The report reflects the work and feedback created earlier.
- Risks should align with the advisor feedback from Step 8.
- This is the stakeholder-facing synthesis layer.

> **What to say:** "The Advisor Analyst closes the loop. It turns project activity into a readable executive summary without forcing stakeholders to inspect every task, document, or agent message."

## Step 10: Inspect Agent Logs

### User Action

1. Open **Agent Logs** from the project sidebar.
2. Scan recent events.
3. Look for AI Workbench, document, task, feedback, and coordination activity.
4. Optionally open **Team Hub** to show accountability and risk signals.

### Behind the Scenes

- Agent actions are persisted in the activity log.
- The Agent Logs page fetches coordination activity from the backend.
- Event broker subscriptions record cross-agent events such as document indexing and task assignment.

### What to Point Out

- CollabAgent provides traceability across agent actions.
- The audit trail supports debugging, accountability, and stakeholder review.
- This differentiates the product from a standalone chat interface.

> **What to say:** "When agents act inside a product, observability matters. Agent Logs make collaboration inspectable instead of opaque."

## Optional Extension: Upload a Real File

Use this if the audience wants to see file-based document management.

### User Action

1. Open **Documents** from the project sidebar.
2. Upload a PDF, DOCX, or TXT file.
3. Watch the file move through extraction and indexing states.
4. Return to **AI Workbench** and ask the Knowledge Agent a question about the uploaded file.

### Behind the Scenes

- React submits multipart form data to `POST /api/projects/:id/documents`.
- Express validates file type and size.
- `pdf-parse`, `mammoth`, or UTF-8 parsing extracts text.
- The backend publishes the same RAG ingestion event used by the Knowledge Agent.
- Indexed chunks become queryable through semantic search.

### What to Point Out

- Supported file types are PDF, DOCX, and TXT.
- Unsupported files return `415 Unsupported Media Type`.
- Oversized files return `413 Payload Too Large`.

## Presenter Pro Tips

### Why Groq and Gemini Are Paired

> **What to say:** "Groq is useful when the product needs fast, structured orchestration: classify intent, draft a small object, or keep the UI responsive. Gemini is useful when the system needs heavier semantic work: synthesize across retrieved chunks, reason over longer context, and produce stakeholder-ready summaries. CollabAgent pairs them so the architecture can optimize for both latency and semantic depth."

### Why SSE Is Used

> **What to say:** "SSE is a good fit for persistent server-to-client updates like notifications and agent status. The browser keeps a lightweight stream open, and the backend can push project events as they happen."

### Why Human Confirmation Matters

> **What to say:** "CollabAgent is autonomous where it helps and governed where it matters. Drafting is automatic; mutating project state requires explicit confirmation through the UI."

### Handling Lag

If a generation call or indexing step takes longer than expected, narrate the pipeline:

- "The request is moving through the agent route."
- "The system is retrieving relevant project context."
- "The provider is generating a structured response."
- "When the user confirms, the backend persists the change and notifies assigned users."

## Troubleshooting Reference

| Symptom | Likely Cause | Presenter Response |
|---|---|---|
| RAG answer is generic | Document indexing is not complete, or provider fallback is active | Wait for indexing, retry the query, and explain asynchronous indexing |
| Recipient does not see notification | Recipient is not assigned, not in project, or SSE needs reconnecting | Confirm membership and assignment, refresh recipient browser, retry |
| Task creation is blocked | Confirmation payload missing or user role is not allowed | Explain `agentGate.js` and human confirmation controls |
| Upload fails with 415 | Unsupported file type | Use PDF, DOCX, or TXT |
| Upload fails with 413 | File exceeds size limit | Use a smaller file |
| Cloud AI call fails | Missing or invalid API key | Switch provider or local fallback and explain provider abstraction |

## Demo Close

Close with the product loop:

1. **Knowledge enters the system** through document ingestion and vector indexing.
2. **Agents reason over that knowledge** through RAG and provider-specific model calls.
3. **Work becomes structured** through task generation, assignment, and confirmation.
4. **The UI updates in real time** through SSE notifications and status events.
5. **Stakeholders get visibility** through reports, logs, risks, and team coordination views.

> **What to say:** "CollabAgent demonstrates what happens when multi-agent AI is integrated into the operating surface of a real project. The value is not only better answers; it is coordinated action, shared context, governed automation, and real-time visibility."

