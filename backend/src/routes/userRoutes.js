const { Router } = require("express");
const { UserController } = require("../controllers");

const router = Router();

router.get("/", UserController.findAll);
router.get("/:id", UserController.findById);
router.post("/", UserController.create);
router.put("/:id", UserController.update);
router.delete("/:id", UserController.delete);

module.exports = router;
