const { ValidationError } = require("../utils/errors");

/**
 * Express middleware factory that validates req.body against a Joi schema.
 *
 * Usage:
 *   router.post("/login", validate(loginSchema), AuthController.login);
 *
 * @param {import("joi").ObjectSchema} schema - The Joi schema to validate against.
 * @returns {Function} Express middleware.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message).join(". ");
      throw new ValidationError(messages);
    }

    next();
  };
}

module.exports = { validate };
