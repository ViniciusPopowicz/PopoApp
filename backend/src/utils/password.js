const bcrypt = require("bcrypt");
const { AUTH_CONFIG } = require("../config");

/**
 * Hashes a plain-text password using bcrypt.
 *
 * @param {string} plainText - The plain-text password to hash.
 * @returns {Promise<string>} The resulting bcrypt hash.
 */
async function hashPassword(plainText) {
  return bcrypt.hash(plainText, AUTH_CONFIG.saltRounds);
}

/**
 * Compares a plain-text password against a bcrypt hash.
 *
 * @param {string} plainText - The plain-text password from the login form.
 * @param {string} hash - The bcrypt hash stored in the database.
 * @returns {Promise<boolean>} True if the password matches the hash.
 */
async function comparePassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

module.exports = { hashPassword, comparePassword };
