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
      CREATE TABLE IF NOT EXISTS direct_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS direct_conversation_members (
        conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS direct_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS idx_direct_conversation_members_user
        ON direct_conversation_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
        ON direct_messages(conversation_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_direct_messages_sender
        ON direct_messages(sender_id);
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
