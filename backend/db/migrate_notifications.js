const pool = require("../config/database");

// Notification-specific migration. Activity log schema updates are consolidated into backend/db/migrate.js
const createNotificationTables = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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
        link TEXT,
        entity_type VARCHAR(64),
        entity_id UUID,
        action_url TEXT,
        metadata JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS link TEXT,
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

      UPDATE notifications
      SET
        link = COALESCE(link, action_url),
        is_read = CASE WHEN read_at IS NOT NULL THEN TRUE ELSE COALESCE(is_read, FALSE) END;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_actor_created ON activity_log(actor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
    `);

    await client.query(`
      DROP INDEX IF EXISTS idx_notifications_user_unread;
      CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE;
    `);

    await client.query("COMMIT");
    console.log("✅ Notification tables migration completed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Notification migration failed:", err);
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
