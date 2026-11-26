const Route = require("../models/Route");
const Stop = require("../models/Stop");
const City = require("../models/City");
const wrap = require("../middleware/asyncHandler");

function normalize(body) {
  return {
    routeNumber: body.routeNumber ?? body.busNumber ?? "",
    busNumber: body.busNumber ?? body.routeNumber ?? "",
    name: body.name, city: body.city, color: body.color || "teal",
    stops: body.stops, active: body.active, description: body.description
  };
}
async function validateRefs(cityId, stopIds) {
  if (!await City.findById(cityId)) return "Valid city is required.";
  if (!Array.isArray(stopIds) || stopIds.length < 2) return "At least two stop IDs are required.";
  if (new Set(stopIds.map(String)).size !== stopIds.length) return "A stop cannot appear twice in one route.";
  const stops = await Stop.find({ _id: { $in: stopIds }, city: cityId, active: true });
  if (stops.length !== stopIds.length) return "All stops must be active and belong to the selected city.";
  return null;
}
exports.list = wrap(async (req, res) => {
  const filter = {};
  if (req.query.city) filter.city = req.query.city;
  if (req.query.active !== undefined) filter.active = req.query.active === "true";
  if (req.query.search) filter.$or = [
    { name: { $regex: req.query.search, $options: "i" } },
    { routeNumber: { $regex: req.query.search, $options: "i" } },
    { busNumber: { $regex: req.query.search, $options: "i" } }
  ];
  const data = await Route.find(filter).populate("city", "name state")
    .populate("stops", "name latitude longitude active").sort({ name: 1 });
  res.json({ success: true, count: data.length, data });
});
exports.getOne = wrap(async (req, res) => {
  const data = await Route.findById(req.params.id).populate("city", "name state")
    .populate("stops", "name latitude longitude active");
  if (!data) return res.status(404).json({ success: false, message: "Route not found." });
  res.json({ success: true, data });
});
exports.create = wrap(async (req, res) => {
  const body = normalize(req.body);
  const issue = await validateRefs(body.city, body.stops);
  if (issue) return res.status(400).json({ success: false, message: issue });
  const created = await Route.create(body);
  const data = await Route.findById(created._id).populate("city", "name state").populate("stops", "name latitude longitude");
  res.status(201).json({ success: true, data });
});
exports.update = wrap(async (req, res) => {
  const current = await Route.findById(req.params.id);
  if (!current) return res.status(404).json({ success: false, message: "Route not found." });
  const body = normalize({ ...current.toObject(), ...req.body });
  const issue = await validateRefs(body.city, body.stops);
  if (issue) return res.status(400).json({ success: false, message: issue });
  Object.assign(current, body);
  await current.save();
  const data = await Route.findById(current._id).populate("city", "name state").populate("stops", "name latitude longitude");
  res.json({ success: true, data });
});
exports.setActive = wrap(async (req, res) => {
  if (typeof req.body.active !== "boolean") return res.status(400).json({ success: false, message: "active must be true or false." });
  const data = await Route.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true }).populate("stops", "name");
  if (!data) return res.status(404).json({ success: false, message: "Route not found." });
  res.json({ success: true, data });
});
exports.remove = wrap(async (req, res) => {
  const data = await Route.findByIdAndDelete(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: "Route not found." });
  res.json({ success: true, message: "Route deleted." });
});
