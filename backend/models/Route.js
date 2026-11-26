const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  routeNumber: { type: String, trim: true, default: "" },
  busNumber: { type: String, trim: true, default: "" },
  name: { type: String, required: true, trim: true },
  city: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },
  color: { type: String, trim: true, default: "teal" },
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: "Stop", required: true }],
  active: { type: Boolean, default: true },
  description: { type: String, trim: true, default: "" }
}, { timestamps: true });
schema.index({ city: 1, name: 1 }, { unique: true });
schema.pre("validate", function(next) {
  if (!this.stops || this.stops.length < 2) this.invalidate("stops", "A route needs at least two stops.");
  next();
});
module.exports = mongoose.model("Route", schema);
