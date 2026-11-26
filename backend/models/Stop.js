const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },
  latitude: { type: Number, min: -90, max: 90, default: null },
  longitude: { type: Number, min: -180, max: 180, default: null },
  address: { type: String, trim: true, default: "" },
  active: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ city: 1, name: 1 }, { unique: true });
module.exports = mongoose.model("Stop", schema);
