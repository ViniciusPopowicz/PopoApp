const { sequelize, DATABASE_CONFIG } = require("./database");
const { APP_CONFIG } = require("./app");
const { AUTH_CONFIG } = require("./auth");

module.exports = {
  sequelize,
  DATABASE_CONFIG,
  APP_CONFIG,
  AUTH_CONFIG,
};
