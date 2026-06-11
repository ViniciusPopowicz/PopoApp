const { APP_CONFIG } = require("../config");

/**
 * Wraps an async route handler to automatically catch errors
 * and forward them to the Express error handler.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Builds a standardized success response payload.
 */
function successResponse(data, message = "Success", statusCode = 200) {
  return {
    success: true,
    statusCode,
    message,
    data,
  };
}

/**
 * Builds a standardized error response payload.
 */
function errorResponse(message = "Internal server error", statusCode = 500, errors = null) {
  const payload = {
    success: false,
    statusCode,
    message,
  };

  if (errors) {
    payload.errors = errors;
  }

  return payload;
}

/**
 * Parses pagination parameters from the request query string.
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || APP_CONFIG.pagination.defaultPage);
  const limit = Math.min(
    APP_CONFIG.pagination.maxLimit,
    Math.max(1, parseInt(query.limit, 10) || APP_CONFIG.pagination.defaultLimit)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Builds pagination metadata for list responses.
 */
function paginationMeta(totalItems, page, limit) {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    totalItems,
    totalPages,
    currentPage: page,
    perPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = {
  asyncHandler,
  successResponse,
  errorResponse,
  parsePagination,
  paginationMeta,
};
