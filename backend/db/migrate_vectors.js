const pool = require("../config/database");

const createVectorTables = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create document_chunks table for persisting embeddings
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chunk_id VARCHAR(255) NOT NULL,
        document_id VARCHAR(255) NOT NULL,
        project_id UUID NOT NULL,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        embedding DOUBLE PRECISION[],
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Indexes for efficient lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_document_chunks_project_id ON document_chunks(project_id);
    `);

    await client.query("COMMIT");
    console.log("✅ Vector persistence migration completed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Vector persistence migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

createVectorTables().catch((err) => {
  console.error(err);
  process.exit(1);
});
