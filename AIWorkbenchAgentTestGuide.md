# AI Workbench Agent Test Guide

This guide provides step-by-step manual tests for the AI Workbench agents:

- Knowledge Agent
- Task Orchestrator
- Team Coordinator
- Feedback Agent
- Advisor Analyst

## Prerequisites

1. Start the backend:

   ```bash
   npm run dev:backend
   ```

2. Start the frontend:

   ```bash
   npm run dev:frontend
   ```

3. Open the app:

   ```text
   http://localhost:3000
   ```

4. Log in and open a project.

5. Navigate to:

   ```text
   Project > AI Workbench
   ```

6. Confirm the backend is running on:

   ```text
   http://localhost:3001
   ```

## 1. Knowledge Agent

Goal: confirm document ingestion and RAG question answering works.

1. Select **Knowledge Agent**.

2. In **Index Project Document**, enter:

   Document title:

   ```text
   Phase 1 MAS Feasibility Notes
   ```

   Document content:

   ```text
   Phase 1 focuses on requirements gathering, use case discovery, technical feasibility, data governance, risk analysis, and ROI evaluation for a multi-agent AI framework in the Data Science division.
   ```

3. Click **Queue**.

4. Expected result:
   - A toast confirms the document was queued.
   - Ingestion activity appears.
   - Agent status changes based on activity.

5. In the composer, ask:

   ```text
   What is Phase 1 focused on?
   ```

6. Click **Send**.

7. Expected result:
   - The response mentions requirements, feasibility, governance, risk, and ROI.
   - Sources appear if indexed chunks are retrieved.

## 2. Task Orchestrator: Single Task

Goal: confirm AI can generate and create one task.

1. Select **Task Orchestrator**.

2. In the composer, enter:

   ```text
   Create a high priority task to evaluate LangGraph for our multi-agent orchestration prototype and assign it to me.
   ```

3. Click **Send**.

4. Expected result:
   - A generated task draft appears.
   - It includes title, priority, and assignee.

5. Click **Create Task** or **Assign to Me**.

6. Expected result:
   - A toast confirms task creation or assignment.
   - The task appears in the Task Board.

## 3. Task Orchestrator: Multiple Tasks

Goal: confirm bulk task generation works.

1. Select **Task Orchestrator**.

2. Paste a long task-generation prompt, such as:

   ```text
   Act as a Principal AI Architect and Lead Technical Project Manager specializing in Multi-Agent Systems and enterprise data science workflows.

   I need a comprehensive, actionable task list for "Phase 1: Requirements and Feasibility Study" for deploying a Multi-Agentic AI framework within our Data Science division.

   Structure the tasks into these workstreams:
   1. Use Case & Agent Role Definition
   2. Technical Feasibility & Architecture Assessment
   3. Data Readiness & Security Compliance
   4. Cost, ROI, & Risk Analysis

   For each task, provide a task title, description, complexity/effort, and potential blocker.
   ```

3. Click **Send**.

4. Expected result:
   - A **Generated Task List** appears.
   - Tasks are labeled by workstream.
   - Each task includes title, description, priority, complexity, and blocker details.

5. Click **Create All**.

6. Expected result:
   - A toast confirms multiple tasks were created.
   - New tasks appear in the Task Board.

## 4. Task Orchestrator: Update Existing Task

Goal: confirm AI can update existing `todo` tasks.

1. Make sure at least one task exists in `todo` status.

2. Select **Task Orchestrator**.

3. Try:

   ```text
   Assign the todo task "Integration Testing" to me.
   ```

4. Click **Send**.

5. Expected result:
   - An **Existing Task Update** panel appears.
   - It shows the task title and new assignee.

6. Click **Apply Update**.

7. Expected result:
   - A toast confirms the task was updated.
   - The Task Board shows the updated assignee.

8. Test deadline update:

   ```text
   Set the deadline for "Integration Testing" to Friday.
   ```

9. Expected result:
   - Existing task update draft shows the parsed deadline.
   - Applying it updates the task deadline.

## 5. Team Coordinator

Goal: confirm meeting notes can be summarized into action items.

1. Select **Team Coordinator**.

2. In the composer, enter:

   ```text
   Today we discussed that Alex should review the task list, Priya should evaluate LangGraph, and Jordan should prepare the data governance checklist. LangGraph evaluation is high priority. The governance checklist is medium priority.
   ```

3. Click **Send**.

4. Expected result:
   - A summary appears.
   - Action item drafts appear.
   - Each item has a title, priority, and assignee if detected.

5. Click **Create** or **Assign to Me** on an action item.

6. Expected result:
   - A task is created.
   - The task appears in the Task Board.

## 6. Feedback Agent

Goal: confirm feedback is recorded and a response template is generated.

1. Select **Feedback Agent**.

2. Choose severity:

   ```text
   High
   ```

3. In the composer, enter:

   ```text
   The team needs to clarify the success metrics for the multi-agent prototype and provide a stronger risk mitigation plan for hallucinations and agent loops.
   ```

4. Click **Send**.

5. Expected result:
   - Feedback is recorded.
   - A structured summary appears.
   - A suggested response template appears.

6. Note:
   - If testing as a student, the backend may log a warning.
   - The route currently allows feedback submission for demo purposes.

## 7. Advisor Analyst

Goal: confirm progress report generation works.

1. Select **Advisor Analyst**.

2. Type:

   ```text
   Generate an advisor-ready weekly progress report.
   ```

3. Click **Send**.

4. Expected result:
   - A Markdown progress report appears.
   - It includes sections such as:
     - Executive Summary
     - Current Velocity & Tasks
     - Risk Assessment & Recommendations

5. If logged in as an advisor:
   - Advisor-side report controls should be visible.
   - You can preview or edit the generated report.

## General Regression Checks

1. Provider dropdown:
   - Try **Auto-Orchestrate**, **Ollama**, **Groq**, or **Gemini**.
   - Expected: the selected provider is included in AI requests and received by the backend.

2. Empty send:
   - Click **Send** with an empty composer.
   - Expected: a toast asks for input, and no fake chat message is added.

3. Search bar:
   - Search for an agent name or previous message.
   - Expected: agent and message lists filter.

4. Project switch:
   - Switch away and back.
   - Expected: AI Workbench state restores from session state.

5. Error handling:
   - Stop the backend and send a request.
   - Expected: a toast error appears, and the page does not white-screen.

## Pass Criteria

The AI Workbench passes this test cycle when:

- Each agent can complete its primary workflow.
- Task creation works for both single-task and multi-task generation.
- Existing `todo` task assignment and deadline updates work through the Task Orchestrator.
- RAG document ingestion and querying work.
- Feedback and progress report generation work.
- The page remains stable during API errors.
