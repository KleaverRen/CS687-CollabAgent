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

test("knowledge augmentation detector handles phase-only task prompts", () => {
  const request =
    "Generate all tasks for Phase 1 and include title, description, and blockers.";

  assert.equal(taskAgent._test.looksLikeRAGAugmentedTaskRequest(request), true);
  assert.deepEqual(
    taskAgent._test.extractKnowledgeReferenceTerms(request).filter((term) =>
      ["phase", "1", "phase 1"].includes(term),
    ),
    ["phase", "1", "phase 1"],
  );
});

test("knowledge document scoring prefers matching phase titles and metadata", () => {
  const terms = taskAgent._test.extractKnowledgeReferenceTerms(
    "Generate tasks for Phase 1 requirements and feasibility.",
  );
  const score = taskAgent._test.scoreKnowledgeDocument(
    {
      title: "Phase 1: Requirements and Feasibility Study",
      content: "Assess technical feasibility and architecture risks.",
      indexed: true,
      embedding_status: "indexed",
      metadata: {
        description: "Deployment plan for the multi-agent framework.",
      },
    },
    terms,
  );

  assert.ok(score >= 10);
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

test("duplicate metadata filter requires stable generated draft identity", () => {
  assert.equal(
    taskAgent._test.buildDuplicateTaskMetadataFilter(
      { source: "team_coordinator_action_item", order: 2 },
      4,
    ),
    "AND metadata->>'source' = $4\n       AND metadata->>'order' = $5",
  );

  assert.equal(taskAgent._test.buildDuplicateTaskMetadataFilter({}, 4), "");
});
