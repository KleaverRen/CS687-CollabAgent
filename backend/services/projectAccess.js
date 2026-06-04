const pool = require("../config/database");

async function canReadProject(user, projectId, client = pool) {
  if (!user?.id || !projectId) return false;

  const result = await client.query(
    `SELECT 1
     FROM projects p
     WHERE p.id = $1
       AND (
         p.owner_id = $2
         OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $2)
         OR p.visibility = 'public'
         OR (
           p.visibility = 'institution'
           AND $3::text IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM users owner
             WHERE owner.id = p.owner_id
               AND owner.institution = $3
           )
         )
       )`,
    [projectId, user.id, user.institution || null],
  );

  return result.rows.length > 0;
}

async function canWriteProject(user, projectId, client = pool) {
  if (!user?.id || !projectId) return false;

  const result = await client.query(
    `SELECT 1
     FROM projects p
     WHERE p.id = $1
       AND (
         p.owner_id = $2
         OR p.id IN (
           SELECT project_id
           FROM project_members
           WHERE user_id = $2
             AND member_role IN ('owner', 'lead', 'member')
         )
       )`,
    [projectId, user.id],
  );

  return result.rows.length > 0;
}

async function canStudentWorkOnProject(user, projectId, client = pool) {
  if (user?.role !== "student") return false;
  return canWriteProject(user, projectId, client);
}

async function canAdviseProject(user, projectId, client = pool) {
  if (!["advisor", "faculty"].includes(user?.role)) return false;

  const result = await client.query(
    `SELECT 1
     FROM projects
     WHERE id = $1
       AND owner_id = $2`,
    [projectId, user.id],
  );

  return result.rows.length > 0;
}

async function isProjectMember(projectId, userId, client = pool) {
  if (!projectId || !userId) return false;

  const result = await client.query(
    `SELECT 1
     FROM project_members
     WHERE project_id = $1
       AND user_id = $2`,
    [projectId, userId],
  );

  return result.rows.length > 0;
}

module.exports = {
  canAdviseProject,
  canReadProject,
  canStudentWorkOnProject,
  canWriteProject,
  isProjectMember,
};
