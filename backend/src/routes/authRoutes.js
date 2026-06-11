const { Router } = require("express");
const { AuthController } = require("../controllers");
const { validate, authenticate, loginSchema } = require("../middlewares");

const router = Router();

/**
 * POST /auth/login
 * Public route — validates request body and authenticates the user.
 */
router.post("/login", validate(loginSchema), AuthController.login);

/**
 * GET /auth/me
 * Protected route — requires a valid JWT to return user profile.
 */
router.get("/me", authenticate, AuthController.me);

module.exports = router;
