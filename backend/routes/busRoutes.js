const router = require("express").Router();
const c = require("../controllers/routeController");
router.get("/", c.list).post("/", c.create);
router.get("/:id", c.getOne).put("/:id", c.update).delete("/:id", c.remove);
router.patch("/:id/status", c.setActive);
module.exports = router;
