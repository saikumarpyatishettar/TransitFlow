const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  state: { type: String, trim: true, default: "" },
  country: { type: String, trim: true, default: "India" },
  code: { type: String, trim: true, uppercase: true, default: "" }
}, { timestamps: true });
schema.index({ name: 1, state: 1, country: 1 }, { unique: true });
module.exports = mongoose.model("City", schema);
