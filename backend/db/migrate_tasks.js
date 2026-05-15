const pool = require('../config/database');

const createTaskTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'todo'
          CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
        priority VARCHAR(50) NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        deadline TIMESTAMPTZ,
        estimated_hours NUMERIC(6,2),
        actual_hours NUMERIC(6,2),
        tags TEXT[] DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Task dependencies (DAG edges)
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        parent_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        child_task_id  UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        dep_type VARCHAR(50) NOT NULL DEFAULT 'blocks'
          CHECK (dep_type IN ('blocks', 'related', 'subtask')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (parent_task_id, child_task_id)
      );
    `);

    // Updated_at trigger for tasks
    await client.query(`
      DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
      CREATE TRIGGER update_tasks_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned   ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_deadline   ON tasks(deadline);
      CREATE INDEX IF NOT EXISTS idx_task_deps_parent ON task_dependencies(parent_task_id);
      CREATE INDEX IF NOT EXISTS idx_task_deps_child  ON task_dependencies(child_task_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Task tables migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Task migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

createTaskTables().catch((err) => {
  console.error(err);
  process.exit(1);
});
