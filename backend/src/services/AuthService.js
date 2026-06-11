const { User } = require("../models");
const { UnauthorizedError } = require("../utils");
const { comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");

/**
 * AuthService contains all business logic related to authentication.
 *
 * Rules:
 *   - Services are the ONLY layer that contains business logic.
 *   - Services interact with models (database) and clients (external APIs).
 *   - Services never access req/res objects directly.
 *   - Services throw custom errors; controllers translate them to HTTP responses.
 */
class AuthService {
  /**
   * Authenticates a user by username and password.
   *
   * @param {string} username - The username from the login form.
   * @param {string} password - The plain-text password from the login form.
   * @returns {Promise<{token: string, user: Object}>} JWT token and sanitized user data.
   * @throws {UnauthorizedError} If credentials are invalid or user is inactive.
   */
  async login(username, password) {
    const user = await User.findOne({
      where: { username, is_active: true },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid username or password");
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid username or password");
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
      },
    };
  }

  /**
   * Retrieves the authenticated user's profile by ID.
   *
   * @param {number} userId - The user ID from the JWT payload.
   * @returns {Promise<Object>} Sanitized user data.
   * @throws {UnauthorizedError} If the user no longer exists or is inactive.
   */
  async getProfile(userId) {
    const user = await User.findOne({
      where: { id: userId, is_active: true },
      attributes: ["id", "username", "name", "email"],
    });

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    return user;
  }
}

module.exports = new AuthService();
