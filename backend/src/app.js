const express = require("express");
const cors = require("cors");
const { APP_CONFIG } = require("./config");
const { errorResponse, logger, AppError } = require("./utils");
const routes = require("./routes");

const app = express();

// --- Core Express Setup ---
app.use(cors(APP_CONFIG.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API Routes ---
app.use(APP_CONFIG.apiPrefix, routes);

// --- Health Check ---
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json(errorResponse("Route not found", 404));
});

// --- Global Error Handler ---
app.use((err, req, res, _next) => {
  logger.error(err.message, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(errorResponse(err.message, err.statusCode));
  }

  return res.status(500).json(errorResponse("Internal server error", 500));
});

module.exports = app;
