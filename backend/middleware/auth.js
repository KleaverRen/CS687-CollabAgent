const jwt = require("jsonwebtoken");
const pool = require("../config/database");

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : undefined;
}

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const authToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : undefined;
    const queryToken =
      typeof req.query.token === "string" ? req.query.token : undefined;
    const cookieToken = getCookie(req, "collabagent_session");

    if (authHeader && !authToken) {
      return res.status(401).json({ error: "Invalid Authorization header" });
    }
    if (!authToken && !cookieToken && !queryToken) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authToken || cookieToken || queryToken;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      "SELECT id, full_name, email, role, avatar_url, institution FROM users WHERE id = $1",
      [decoded.userId],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    next(err);
  }
};

const authenticateSSE = async (req, res, next) => {
  try {
    if (req.headers.authorization) {
      return res.status(400).json({
        error:
          "SSE endpoints must use a dedicated SSE token or cookie and should not accept Authorization headers on this path.",
      });
    }

    const sseToken =
      getCookie(req, "collabagent_session") ||
      (typeof req.query.sse_token === "string"
        ? req.query.sse_token
        : typeof req.query.token === "string"
          ? req.query.token
          : undefined);
    if (!sseToken) {
      return res.status(401).json({ error: "No SSE token provided" });
    }

    const decoded = jwt.verify(sseToken, process.env.JWT_SECRET);
    const result = await pool.query(
      "SELECT id, full_name, email, role, avatar_url, institution FROM users WHERE id = $1",
      [decoded.userId],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid SSE token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "SSE token expired" });
    }
    next(err);
  }
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };

module.exports = { authenticate, authenticateSSE, authorize };
