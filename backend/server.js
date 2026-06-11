const app = require("./src/app");
const { APP_CONFIG } = require("./src/config");
const { logger } = require("./src/utils");
const { sequelize } = require("./src/models");

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info("Database connection established successfully");

    await sequelize.sync();
    logger.info("Database models synchronized");

    app.listen(APP_CONFIG.port, () => {
      logger.info(`Server running on port ${APP_CONFIG.port}`);
      logger.info(`API available at http://localhost:${APP_CONFIG.port}${APP_CONFIG.apiPrefix}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  }
}

startServer();
