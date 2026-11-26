const Stop = require("../models/Stop");
const City = require("../models/City");
const Route = require("../models/Route");
const wrap = require("../middleware/asyncHandler");
exports.list = wrap(async (req, res) => {
  const filter = {};
  if (req.query.city) filter.city = req.query.city;
  if (req.query.active !== undefined) filter.active = req.query.active === "true";
  if (req.query.search) filter.name = { $regex: req.query.search, $options: "i" };
  const data = await Stop.find(filter).populate("city", "name state").sort({ name: 1 });
  res.json({ success: true, count: data.length, data });
});
exports.create = wrap(async (req, res) => {
  const city = await City.findById(req.body.city);
  if (!city) return res.status(400).json({ success: false, message: "Valid city is required." });
  const data = await Stop.create({
    name: req.body.name, city: city._id,
    latitude: req.body.latitude ?? req.body.lat ?? null,
    longitude: req.body.longitude ?? req.body.lng ?? null,
    address: req.body.address, active: req.body.active
  });
  res.status(201).json({ success: true, data });
});
exports.update = wrap(async (req, res) => {
  const body = { ...req.body };
  if (body.lat !== undefined) body.latitude = body.lat;
  if (body.lng !== undefined) body.longitude = body.lng;
  delete body.lat; delete body.lng;
  const data = await Stop.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).populate("city", "name state");
  if (!data) return res.status(404).json({ success: false, message: "Stop not found." });
  res.json({ success: true, data });
});
exports.remove = wrap(async (req, res) => {
  const stop = await Stop.findById(req.params.id);
  if (!stop) return res.status(404).json({ success: false, message: "Stop not found." });
  await Route.updateMany({ stops: stop._id }, { $pull: { stops: stop._id } });
  await stop.deleteOne();
  res.json({ success: true, message: "Stop deleted and removed from routes." });
});
