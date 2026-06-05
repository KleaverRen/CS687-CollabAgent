const pool = require("../config/database");

const createChatTables = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL CHECK (char_length(content) > 0),
        edited_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_messages_project_created
        ON project_messages(project_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_project_messages_sender
        ON project_messages(sender_id);
    `);

    await client.query("COMMIT");
    console.log("✅ Chat tables migration completed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Chat migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

createChatTables().catch((err) => {
  console.error(err);
  process.exit(1);
});
