const { User } = require("../models");
const { NotFoundError, ConflictError, ValidationError } = require("../utils");

/**
 * UserService contains all business logic related to User operations.
 *
 * Rules:
 *   - Services are the ONLY layer that contains business logic.
 *   - Services interact with models (database) and clients (external APIs).
 *   - Services never access req/res objects directly.
 *   - Services throw custom errors; controllers translate them to HTTP responses.
 */
class UserService {
  async findAll({ limit, offset }) {
    const { count, rows } = await User.findAndCountAll({
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return { count, rows };
  }

  async findById(id) {
    const user = await User.findByPk(id);

    if (!user) {
      throw new NotFoundError("User");
    }

    return user;
  }

  async create(data) {
    const existingUser = await User.findOne({ where: { email: data.email } });

    if (existingUser) {
      throw new ConflictError("A user with this email already exists");
    }

    const user = await User.create(data);
    return user;
  }

  async update(id, data) {
    const user = await this.findById(id);

    await user.update(data);
    return user;
  }

  async delete(id) {
    const user = await this.findById(id);

    await user.destroy();
    return true;
  }
}

module.exports = new UserService();
