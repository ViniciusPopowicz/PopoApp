const jwt = require("jsonwebtoken");
const { AUTH_CONFIG } = require("../config");

/**
 * Generates a signed JWT token for the given payload.
 *
 * @param {Object} payload - Data to encode in the token (e.g. { id, username }).
 * @returns {string} The signed JWT string.
 */
function generateToken(payload) {
  return jwt.sign(payload, AUTH_CONFIG.jwtSecret, {
    expiresIn: AUTH_CONFIG.jwtExpiration,
  });
}

/**
 * Verifies and decodes a JWT token.
 *
 * @param {string} token - The JWT string to verify.
 * @returns {Object} The decoded token payload.
 * @throws {JsonWebTokenError|TokenExpiredError} If the token is invalid or expired.
 */
function verifyToken(token) {
  return jwt.verify(token, AUTH_CONFIG.jwtSecret);
}

module.exports = { generateToken, verifyToken };
