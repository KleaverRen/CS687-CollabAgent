require("dotenv").config();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("../config/database");

const SEED_DIR = path.join(__dirname, "seeds");
const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD || "CollabAgent123!";

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function parseCsv(fileName) {
  const filePath = path.join(SEED_DIR, fileName);
  const text = fs.readFileSync(filePath, "utf8").trim();
  const [headerLine, ...rows] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return rows
    .filter((row) => row.trim())
    .map((row) => {
      const values = parseCsvLine(row);
      return headers.reduce((record, header, index) => {
        record[header] = values[index] || "";
        return record;
      }, {});
    });
}

function parseList(value) {
  return value
    ? value
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

async function seedUsers(client, users, role, passwordHash) {
  for (const user of users) {
    await client.query(
      `
      INSERT INTO users (
        full_name,
        email,
        password_hash,
        role,
        institution,
        job_title,
        location,
        organization,
        bio,
        research_interests,
        email_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
      ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        institution = EXCLUDED.institution,
        job_title = EXCLUDED.job_title,
        location = EXCLUDED.location,
        organization = EXCLUDED.organization,
        bio = EXCLUDED.bio,
        research_interests = EXCLUDED.research_interests,
        email_verified = TRUE,
        updated_at = NOW()
      `,
      [
        user.full_name,
        user.email,
        passwordHash,
        role,
        user.institution || "City University",
        user.job_title || (role === "advisor" ? "Faculty Advisor" : "Graduate Student"),
        user.location || "Seattle WA",
        user.organization || "School of Computer Science",
        user.bio || null,
        parseList(user.research_interests),
      ],
    );
  }
}

async function seed() {
  console.log("Starting database seed...");

  const advisors = parseCsv("advisors.csv");
  const students = parseCsv("students.csv");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Resetting app data...");
    await client.query(`
      TRUNCATE TABLE
        task_dependencies,
        tasks,
        ai_workbench_messages,
        ai_workbench_sessions,
        direct_messages,
        direct_conversation_members,
        direct_conversations,
        project_messages,
        notifications,
        activity_log,
        feedback_responses,
        feedback,
        risk_register,
        document_chunks,
        documents,
        agents,
        project_members,
        projects,
        sessions,
        users
      RESTART IDENTITY CASCADE
    `);

    console.log(`Inserting ${advisors.length} advisors...`);
    await seedUsers(client, advisors, "advisor", passwordHash);

    console.log(`Inserting ${students.length} students...`);
    await seedUsers(client, students, "student", passwordHash);

    await client.query("COMMIT");

    console.log("Database seeded successfully.");
    console.log(`Seeded ${advisors.length} advisors and ${students.length} students.`);
    console.log(`Default seed password: ${DEFAULT_PASSWORD}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => {
  process.exit(1);
});
