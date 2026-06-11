const { AuthService } = require("../services");
const { asyncHandler, successResponse } = require("../utils");

/**
 * AuthController handles HTTP request/response logic for authentication.
 *
 * Rules:
 *   - Controllers MUST NOT contain business logic.
 *   - Controllers delegate all work to the corresponding service.
 *   - Controllers parse request data, call services, and format responses.
 *   - Error handling is done via asyncHandler + centralized error handler.
 */
class AuthController {
  /**
   * POST /auth/login
   * Authenticates a user and returns a JWT token.
   */
  login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const result = await AuthService.login(username, password);

    res.status(200).json(successResponse(result, "Login successful"));
  });

  /**
   * GET /auth/me
   * Returns the authenticated user's profile.
   * Requires a valid JWT (enforced by authenticate middleware).
   */
  me = asyncHandler(async (req, res) => {
    const user = await AuthService.getProfile(req.user.id);

    res.status(200).json(successResponse(user, "Profile retrieved successfully"));
  });
}

module.exports = new AuthController();
