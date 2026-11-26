const router = require("express").Router();
const c = require("../controllers/cityController");
router.get("/", c.list).post("/", c.create);
router.put("/:id", c.update).delete("/:id", c.remove);
module.exports = router;
