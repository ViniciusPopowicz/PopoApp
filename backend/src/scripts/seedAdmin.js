const { sequelize } = require("../config");
const { User } = require("../models");
const { hashPassword } = require("../utils/password");
const { logger } = require("../utils");

/**
 * Seed script — Creates an initial admin user for testing authentication.
 *
 * Idempotent: skips creation if the user already exists.
 *
 * Usage:
 *   node src/scripts/seedAdmin.js
 */
async function seedAdmin() {
  const ADMIN_USERNAME = "admin";
  const ADMIN_PASSWORD = "admin123";
  const ADMIN_EMAIL = "admin@popoapp.com";
  const ADMIN_NAME = "Administrator";

  try {
    await sequelize.authenticate();
    logger.info("Database connection established");

    await sequelize.sync();
    logger.info("Database models synchronized");

    const existingUser = await User.findOne({ where: { username: ADMIN_USERNAME } });

    if (existingUser) {
      logger.info(`User "${ADMIN_USERNAME}" already exists — skipping seed`);
      process.exit(0);
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    await User.create({
      username: ADMIN_USERNAME,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password_hash: passwordHash,
      is_active: true,
    });

    logger.info(`Admin user created successfully`);
    logger.info(`  Username: ${ADMIN_USERNAME}`);
    logger.info(`  Password: ${ADMIN_PASSWORD}`);
    logger.info(`  Email:    ${ADMIN_EMAIL}`);

    process.exit(0);
  } catch (error) {
    logger.error("Seed failed", { error: error.message });
    process.exit(1);
  }
}

seedAdmin();
