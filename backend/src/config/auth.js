const AUTH_CONFIG = {
  jwtSecret: process.env.JWT_SECRET || "popoapp_jwt_secret_dev_only",
  jwtExpiration: process.env.JWT_EXPIRATION || "8h",
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
};

module.exports = { AUTH_CONFIG };
