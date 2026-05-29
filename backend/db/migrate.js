const pool = require('../config/database');

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('advisor', 'student')),
        avatar_url TEXT,
        institution VARCHAR(255),
        bio TEXT,
        sso_provider VARCHAR(50),
        sso_id VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      UPDATE users
      SET role = CASE
        WHEN role IN ('advisor', 'faculty', 'project_lead', 'researcher') THEN 'advisor'
        ELSE 'student'
      END;

      ALTER TABLE users
      ALTER COLUMN role SET DEFAULT 'student';

      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_role_check;

      ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('advisor', 'student'));
    `);

    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        advisor_name VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quarter VARCHAR(20) CHECK (quarter IN ('Fall', 'Winter', 'Spring', 'Summer')),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'paused')),
        visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'institution')),
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS quarter VARCHAR(20)
      CHECK (quarter IN ('Fall', 'Winter', 'Spring', 'Summer'));
    `);

    // Project members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        member_role VARCHAR(50) DEFAULT 'member' CHECK (member_role IN ('owner', 'lead', 'member', 'viewer')),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (project_id, user_id)
      );
    `);

    // Agents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'paused', 'error')),
        config JSONB DEFAULT '{}',
        last_active_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Knowledge base documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        uploaded_by UUID REFERENCES users(id),
        title VARCHAR(500) NOT NULL,
        content TEXT,
        file_url TEXT,
        file_type VARCHAR(100),
        file_size_bytes BIGINT,
        indexed BOOLEAN DEFAULT FALSE,
        embedding_status VARCHAR(50) DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS content TEXT,
      ADD COLUMN IF NOT EXISTS file_url TEXT,
      ADD COLUMN IF NOT EXISTS file_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
      ADD COLUMN IF NOT EXISTS indexed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // Activity log for Team Coordination Agent
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        event_type VARCHAR(64) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

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

    // Structured feedback from advisors
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        advisor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        milestone_ref VARCHAR(128),
        category VARCHAR(64),
        severity VARCHAR(16) DEFAULT 'medium',
        body TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'posted',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
    `);

    // Student responses to advisor feedback
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback_responses (
        id SERIAL PRIMARY KEY,
        feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Risk register for Progress Monitoring Agent
    await client.query(`
      CREATE TABLE IF NOT EXISTS risk_register (
        id SERIAL PRIMARY KEY,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        risk_type VARCHAR(64),
        severity VARCHAR(16),
        description TEXT,
        source_ref VARCHAR(128),
        suggested_action TEXT,
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Persistent AI Workbench chat sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_workbench_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'New chat',
        active_agent VARCHAR(64) NOT NULL DEFAULT 'rag',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_workbench_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES ai_workbench_sessions(id) ON DELETE CASCADE,
        sender VARCHAR(32) NOT NULL CHECK (sender IN ('user', 'agent')),
        agent_id VARCHAR(64),
        text TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Apply updated_at triggers
    for (const table of ['users', 'projects', 'ai_workbench_sessions']) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_documents_project_status ON documents(project_id, embedding_status);
      CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_actor_created ON activity_log(actor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_workbench_sessions_user_project ON ai_workbench_sessions(user_id, project_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_workbench_messages_session_created ON ai_workbench_messages(session_id, created_at ASC);
    `);

    await client.query(`
      DROP INDEX IF EXISTS idx_notifications_user_unread;
      CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE;
    `);

    await client.query('COMMIT');
    console.log('✅ Database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables().catch((err) => {
  console.error(err);
  process.exit(1);
});
