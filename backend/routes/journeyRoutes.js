const router = require("express").Router();
const c = require("../controllers/journeyController");
router.post("/", c.plan);
router.get("/", c.plan);
router.post("/by-name", c.planByName);
module.exports = router;
