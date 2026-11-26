const City = require("../models/City");
const Stop = require("../models/Stop");
const Route = require("../models/Route");
const wrap = require("../middleware/asyncHandler");
exports.list = wrap(async (req, res) => {
  const q = req.query.search ? { name: { $regex: req.query.search, $options: "i" } } : {};
  const data = await City.find(q).sort({ name: 1 });
  res.json({ success: true, count: data.length, data });
});
exports.create = wrap(async (req, res) => {
  const data = await City.create(req.body);
  res.status(201).json({ success: true, data });
});
exports.update = wrap(async (req, res) => {
  const data = await City.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!data) return res.status(404).json({ success: false, message: "City not found." });
  res.json({ success: true, data });
});
exports.remove = wrap(async (req, res) => {
  const city = await City.findById(req.params.id);
  if (!city) return res.status(404).json({ success: false, message: "City not found." });
  await Route.deleteMany({ city: city._id });
  await Stop.deleteMany({ city: city._id });
  await city.deleteOne();
  res.json({ success: true, message: "City and its routes/stops deleted." });
});
