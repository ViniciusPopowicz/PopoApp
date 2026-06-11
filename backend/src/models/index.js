const { sequelize } = require("../config");
const User = require("./User");

/**
 * Define all model associations here.
 * This function is called once during app initialization
 * after all models are loaded.
 *
 * Example:
 *   User.hasMany(Order, { foreignKey: "user_id", as: "orders" });
 *   Order.belongsTo(User, { foreignKey: "user_id", as: "user" });
 */
function defineAssociations() {
  // Register associations between models here
}

defineAssociations();

module.exports = {
  sequelize,
  User,
};
