const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const taskAgent = require(path.resolve(
  __dirname,
  "../routes/agents/task.js",
));

test("task breakdown detector handles comprehensive workstream prompts", () => {
  const request = `Act as a Principal AI Architect and Lead Technical Project Manager specializing in Multi-Agent Systems and enterprise data science workflows.

I need a comprehensive, actionable task list for "Phase 1: Requirements and Feasibility Study" for deploying a Multi-Agentic AI framework within our Data Science division.

Structure the tasks into these workstreams:
1. Use Case & Agent Role Definition
2. Technical Feasibility & Architecture Assessment
3. Data Readiness & Security Compliance
4. Cost, ROI, & Risk Analysis

For each task, provide a task title, description, complexity/effort, and potential blocker.`;

  assert.equal(taskAgent._test.looksLikeTaskBreakdownRequest(request), true);
});

test("single task draft normalization prevents blank generated titles", () => {
  const draft = taskAgent._test.normalizeSingleTaskDraft(
    { priority: "urgent" },
    "Follow up with the data platform team about Snowflake access.",
  );

  assert.equal(
    draft.title,
    "Follow up with the data platform team about Snowflake access.",
  );
  assert.equal(draft.priority, "critical");
  assert.equal(draft.assignee_name, null);
});
