const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

const DEFAULT_PROFILE = {
  job_title: "Director of Computational Ethics",
  organization: "CollabAgent AI",
  location: "San Francisco, CA",
  bio: "This researcher has not added a professional overview yet.",
  research_interests: [
    "Neural Alignment",
    "Ethical AI",
    "Societal Bias",
    "Human-AI Collaboration",
    "Computational Ethics",
    "Bias Detection",
  ],
  publications: [
    {
      title: "Measuring Alignment Drift in Collaborative Agent Systems",
      publisher: "MIT Press",
      year: "2022",
      href: "#alignment-drift",
    },
    {
      title: "Human Review Loops for High-Impact Generative Workflows",
      publisher: "ACM FAccT Proceedings",
      year: "2023",
      href: "#review-loops",
    },
    {
      title: "Bias Detection Under Multi-Agent Summarization",
      publisher: "Journal of Responsible AI",
      year: "2024",
      href: "#bias-detection",
    },
  ],
  academic_links: {
    google_scholar: "https://scholar.google.com",
    github: "https://github.com",
    orcid: "https://orcid.org",
    cv: "/Aurora-Thorne-CV.pdf",
  },
};

const PROFILE_SELECT = `
  SELECT id, full_name, email, role, avatar_url, institution, job_title,
         location, organization, bio, research_interests, publications,
         academic_links, created_at, updated_at,
         (SELECT COUNT(*) FROM projects WHERE owner_id = u.id) AS projects_owned,
         (SELECT COUNT(*) FROM project_members WHERE user_id = u.id) AS projects_joined
  FROM users u
  WHERE id = $1
`;

function compactString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePublication(publication) {
  if (!publication || typeof publication !== "object" || Array.isArray(publication)) {
    return null;
  }
  const title = compactString(publication.title);
  if (!title) return null;
  return {
    title,
    publisher: compactString(publication.publisher) || "Independent Research",
    year: compactString(publication.year) || new Date().getFullYear().toString(),
    href: compactString(publication.href) || "#",
  };
}

function normalizeAcademicLinks(links) {
  if (!links || typeof links !== "object" || Array.isArray(links)) return {};
  return {
    google_scholar: compactString(links.google_scholar),
    github: compactString(links.github),
    orcid: compactString(links.orcid),
    cv: compactString(links.cv),
  };
}

function serializeProfile(row) {
  const researchInterests =
    Array.isArray(row.research_interests) && row.research_interests.length
      ? row.research_interests
      : DEFAULT_PROFILE.research_interests;
  const publications =
    Array.isArray(row.publications) && row.publications.length
      ? row.publications
      : DEFAULT_PROFILE.publications;
  const academicLinks =
    row.academic_links && Object.keys(row.academic_links).length
      ? row.academic_links
      : DEFAULT_PROFILE.academic_links;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    avatar_url: row.avatar_url,
    institution: row.institution,
    job_title: row.job_title || DEFAULT_PROFILE.job_title,
    location: row.location || DEFAULT_PROFILE.location,
    organization:
      row.organization || row.institution || DEFAULT_PROFILE.organization,
    bio: row.bio || DEFAULT_PROFILE.bio,
    research_interests: researchInterests,
    publications,
    academic_links: academicLinks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    projects_owned: Number(row.projects_owned || 0),
    projects_joined: Number(row.projects_joined || 0),
  };
}

// GET /api/users - List users with optional role filtering
router.get("/", async (req, res) => {
  const { role } = req.query;
  if (req.user.role !== "advisor") {
    return res.status(403).json({ error: "Advisor permissions required" });
  }

  try {
    let query =
      "SELECT id, full_name, email, role, avatar_url, institution FROM users";
    const params = [];

    // Allow filtering by role (e.g., ?role=student)
    if (role) {
      query += " WHERE role = $1";
      params.push(role);
    }

    query += " ORDER BY full_name ASC";

    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/profile
router.get("/profile", async (req, res) => {
  try {
    const result = await pool.query(PROFILE_SELECT, [req.user.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({ user: serializeProfile(result.rows[0]) });
  } catch (err) {
    console.error("Fetch profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/profile
router.patch(
  "/profile",
  [
    body("full_name")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage("Full name must be 1-255 characters."),
    body("institution")
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Institution must be 255 characters or fewer."),
    body("job_title")
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Job title must be 255 characters or fewer."),
    body("location")
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Location must be 255 characters or fewer."),
    body("organization")
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Organization must be 255 characters or fewer."),
    body("bio")
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 1200 })
      .withMessage("Bio must be 1200 characters or fewer."),
    body("avatar_url")
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 2048 })
      .withMessage("Avatar URL must be 2048 characters or fewer."),
    body("research_interests")
      .optional()
      .isArray({ max: 20 })
      .withMessage("Research interests must be a list of up to 20 tags."),
    body("research_interests.*")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 80 })
      .withMessage("Each research interest must be 1-80 characters."),
    body("publications")
      .optional()
      .isArray({ max: 20 })
      .withMessage("Publications must be a list of up to 20 records."),
    body("academic_links")
      .optional()
      .isObject()
      .withMessage("Academic links must be an object."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const updates = {};
    [
      "full_name",
      "institution",
      "job_title",
      "location",
      "organization",
      "bio",
      "avatar_url",
    ].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = compactString(req.body[field]);
      }
    });

    if (Object.prototype.hasOwnProperty.call(req.body, "research_interests")) {
      updates.research_interests = [
        ...new Set(
          req.body.research_interests
            .map(compactString)
            .filter(Boolean),
        ),
      ];
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "publications")) {
      updates.publications = req.body.publications
        .map(normalizePublication)
        .filter(Boolean);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "academic_links")) {
      updates.academic_links = normalizeAcademicLinks(req.body.academic_links);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No profile fields provided" });
    }

    try {
      const fields = [];
      const values = [];
      Object.entries(updates).forEach(([field, value]) => {
        values.push(value);
        fields.push(`${field} = $${values.length}`);
      });
      values.push(req.user.id);

      const result = await pool.query(
        `UPDATE users
         SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id`,
        values,
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const profileResult = await pool.query(PROFILE_SELECT, [req.user.id]);
      res.json({ user: serializeProfile(profileResult.rows[0]) });
    } catch (err) {
      console.error("Update profile error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PATCH /api/users/password
router.patch(
  "/password",
  [
    body("current_password").notEmpty(),
    body("new_password").isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { current_password, new_password } = req.body;
    try {
      const result = await pool.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [req.user.id],
      );
      const valid = await bcrypt.compare(
        current_password,
        result.rows[0].password_hash,
      );
      if (!valid)
        return res.status(401).json({ error: "Current password incorrect" });

      const hash = await bcrypt.hash(new_password, 12);
      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        hash,
        req.user.id,
      ]);
      res.json({ message: "Password updated successfully" });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/users/dashboard-stats
router.get("/dashboard-stats", async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM projects p
          WHERE p.owner_id = $1
             OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)) as total_projects,
        (SELECT COUNT(*) FROM projects p
          WHERE p.status = 'active'
            AND (p.owner_id = $1
              OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1))) as active_projects,
        (SELECT COUNT(*) FROM project_members WHERE user_id = $1) as collaborations,
        (SELECT COUNT(*) FROM documents d
          JOIN projects p ON d.project_id = p.id
          WHERE p.owner_id = $1
             OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)) as total_documents`,
      [req.user.id],
    );
    res.json({ stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
