const pool = require('../config/database');

const createNotificationTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE activity_log
      ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64),
      ADD COLUMN IF NOT EXISTS entity_id UUID,
      ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) DEFAULT 'project',
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        activity_id INTEGER REFERENCES activity_log(id) ON DELETE SET NULL,
        type VARCHAR(64) NOT NULL,
        category VARCHAR(64) NOT NULL DEFAULT 'updates',
        title VARCHAR(255) NOT NULL,
        body TEXT,
        entity_type VARCHAR(64),
        entity_id UUID,
        action_url TEXT,
        metadata JSONB DEFAULT '{}',
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_actor_created ON activity_log(actor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
    `);

    await client.query('COMMIT');
    console.log('✅ Notification tables migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Notification migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

createNotificationTables().catch((err) => {
  console.error(err);
  process.exit(1);
});
