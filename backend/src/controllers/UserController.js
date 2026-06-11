const { UserService } = require("../services");
const { asyncHandler, successResponse, errorResponse, parsePagination, paginationMeta } = require("../utils");

/**
 * UserController handles HTTP request/response logic only.
 *
 * Rules:
 *   - Controllers MUST NOT contain business logic.
 *   - Controllers delegate all work to the corresponding service.
 *   - Controllers parse request data, call services, and format responses.
 *   - Error handling is done via asyncHandler + centralized error handler.
 */
class UserController {
  findAll = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { count, rows } = await UserService.findAll({ limit, offset });

    res.status(200).json(
      successResponse(
        {
          users: rows,
          pagination: paginationMeta(count, page, limit),
        },
        "Users retrieved successfully"
      )
    );
  });

  findById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await UserService.findById(id);

    res.status(200).json(successResponse(user, "User retrieved successfully"));
  });

  create = asyncHandler(async (req, res) => {
    const user = await UserService.create(req.body);

    res.status(201).json(successResponse(user, "User created successfully", 201));
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await UserService.update(id, req.body);

    res.status(200).json(successResponse(user, "User updated successfully"));
  });

  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await UserService.delete(id);

    res.status(200).json(successResponse(null, "User deleted successfully"));
  });
}

module.exports = new UserController();
