const { Sequelize } = require("sequelize");

const DATABASE_CONFIG = {
  dialect: "postgres",
  host: "localhost",
  port: 5432,
  database: "popoapp_db",
  username: "popoapp_user",
  password: "popoapp_password",
  logging: false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  },
};

const sequelize = new Sequelize(
  DATABASE_CONFIG.database,
  DATABASE_CONFIG.username,
  DATABASE_CONFIG.password,
  {
    host: DATABASE_CONFIG.host,
    port: DATABASE_CONFIG.port,
    dialect: DATABASE_CONFIG.dialect,
    logging: DATABASE_CONFIG.logging,
    pool: DATABASE_CONFIG.pool,
    define: DATABASE_CONFIG.define,
  }
);

module.exports = { sequelize, DATABASE_CONFIG };
