const { Router } = require("express");
const { APP_CONFIG } = require("../config");

const userRoutes = require("./userRoutes");
const authRoutes = require("./authRoutes");

const router = Router();

/**
 * Register all resource routes here.
 * Each resource gets its own route file and is mounted under the API prefix.
 */
router.use("/users", userRoutes);
router.use("/auth", authRoutes);

module.exports = router;
