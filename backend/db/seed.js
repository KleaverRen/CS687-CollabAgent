require("dotenv").config();
const pool = require("../config/database");

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // 1. Clear existing data in reverse order of dependencies
    console.log("Clearing existing data...");
    await pool.query("DELETE FROM task_dependencies");
    await pool.query("DELETE FROM tasks");
    await pool.query("DELETE FROM project_members");
    await pool.query("DELETE FROM projects");
    // Only delete mock users, to preserve any real users you might have created
    await pool.query(
      "DELETE FROM users WHERE email LIKE '%@mock.collabagent.test'",
    );

    // 2. Create Mock Users
    console.log("Inserting mock users...");
    const usersResult = await pool.query(`
      INSERT INTO users (id, full_name, email, password_hash, role)
      VALUES 
        (gen_random_uuid(), 'Alex Chen', 'alex@mock.collabagent.test', '$2a$12$NtLemWQmcWHRqDeXRyQHDO24NuZptHJPUyWlx2XRZxkcFMOeaYEaW', 'student'),
        (gen_random_uuid(), 'Priya Nair', 'priya@mock.collabagent.test', '$2a$12$NtLemWQmcWHRqDeXRyQHDO24NuZptHJPUyWlx2XRZxkcFMOeaYEaW', 'student'),
        (gen_random_uuid(), 'Jordan Lee', 'jordan@mock.collabagent.test', '$2a$12$NtLemWQmcWHRqDeXRyQHDO24NuZptHJPUyWlx2XRZxkcFMOeaYEaW', 'student'),
        (gen_random_uuid(), 'Julian Park', 'julian@mock.collabagent.test', '$2a$12$NtLemWQmcWHRqDeXRyQHDO24NuZptHJPUyWlx2XRZxkcFMOeaYEaW', 'advisor')
      RETURNING id, full_name;
    `);
    const users = usersResult.rows;

    // 3. Create a Mock Project
    console.log("Inserting mock project...");
    const projectResult = await pool.query(
      `
      INSERT INTO projects (id, name, description, owner_id, advisor_name)
      VALUES (gen_random_uuid(), 'AI-Augmented Workflow Rollout', 'Deploying the new predictive task management system.', $1, $2)
      RETURNING id;
    `,
      [users[3].id, users[3].full_name],
    );
    const projectId = projectResult.rows[0].id;

    // 4. Add Members to Project
    console.log("Adding members to project...");
    for (const u of users) {
      await pool.query(
        `
        INSERT INTO project_members (project_id, user_id, member_role)
        VALUES ($1, $2, $3)
      `,
        [projectId, u.id, u.id === users[3].id ? "owner" : "member"],
      );
    }

    // 5. Create Mock Tasks (with deadlines for testing reminder system)
    console.log("Inserting mock tasks...");
    const now = new Date();
    const taskData = [
      {
        title: "API Endpoint Design",
        status: "done",
        priority: "high",
        est: 6,
        tags: ["api", "design"],
        assignee: users[0].id,
        // Already done — no reminder expected
        deadline: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Database Schema Migration",
        status: "in_progress",
        priority: "critical",
        est: 4,
        tags: ["database"],
        assignee: users[1].id,
        // Deadline in 2 days — should trigger "deadline.upcoming" reminder
        deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Frontend Kanban Board",
        status: "blocked",
        priority: "medium",
        est: 18,
        tags: ["frontend", "design"],
        assignee: users[2].id,
        // Deadline in 1 day — should trigger "deadline.urgent" reminder
        deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      },
      {
        title: "AI Suggestion Engine",
        status: "todo",
        priority: "high",
        est: 14,
        tags: ["ai", "api"],
        assignee: null,
        // Deadline in 3 days — no reminder (outside 2-day window) and no assignee
        deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Integration Testing",
        status: "todo",
        priority: "medium",
        est: 8,
        tags: ["testing"],
        assignee: users[0].id,
        // Deadline 2 days ago, not done — should trigger "deadline.overdue" reminder
        deadline: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    ];

    const taskIds = [];
    for (const t of taskData) {
      const res = await pool.query(
        `
        INSERT INTO tasks (project_id, title, status, priority, estimated_hours, tags, assigned_to, created_by, deadline)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id;
      `,
        [
          projectId,
          t.title,
          t.status,
          t.priority,
          t.est,
          t.tags,
          t.assignee,
          users[3].id,
          t.deadline,
        ],
      );
      taskIds.push(res.rows[0].id);
    }

    // 6. Create Task Dependencies
    // Tasks: [0: API, 1: DB Migration, 2: Kanban, 3: AI, 4: Testing]
    // 0 blocks 2
    // 1 blocks 2
    // 1 blocks 3
    // 2 blocks 4
    // 3 blocks 4
    console.log("Inserting task dependencies...");
    const edges = [
      { p: 0, c: 2 },
      { p: 1, c: 2 },
      { p: 1, c: 3 },
      { p: 2, c: 4 },
      { p: 3, c: 4 },
    ];

    for (const edge of edges) {
      await pool.query(
        `
        INSERT INTO task_dependencies (parent_task_id, child_task_id, dep_type)
        VALUES ($1, $2, 'blocks')
      `,
        [taskIds[edge.p], taskIds[edge.c]],
      );
    }

    console.log("✅ Database seeded successfully!");
    console.log(
      `\nMock Users (Password: same as your existing user accounts):`,
    );
    users.forEach((u) => console.log(`- ${u.full_name}`));
    console.log(`\nMock Project ID: ${projectId}`);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    pool.end();
  }
}

seed();
