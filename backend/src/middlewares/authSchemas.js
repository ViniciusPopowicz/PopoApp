const Joi = require("joi");

/**
 * Joi schema for the login request body.
 *
 * Validates:
 *   - username: required string, 3–50 characters
 *   - password: required string, minimum 1 character
 */
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Username is required",
    "string.min": "Username must be at least 3 characters",
    "string.max": "Username must be at most 50 characters",
    "any.required": "Username is required",
  }),
  password: Joi.string().min(1).required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

module.exports = { loginSchema };
