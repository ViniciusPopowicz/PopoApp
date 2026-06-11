const { verifyToken } = require("../utils/jwt");
const { UnauthorizedError } = require("../utils/errors");

/**
 * Express middleware that protects routes by requiring a valid JWT.
 *
 * Extracts the token from the Authorization header (Bearer scheme),
 * verifies it, and attaches the decoded payload to req.user.
 * Returns 401 if the token is missing, invalid, or expired.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Access token is required");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

module.exports = { authenticate };
