require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const City = require("../models/City");
const Stop = require("../models/Stop");
const Route = require("../models/Route");

const sampleRoutes = [
  { name: "Purple Corridor", number: "TF001", color: "teal", stops: ["Majestic", "Vijayanagar", "Attiguppe", "Deepanjali Nagar", "Mysore Road"] },
  { name: "Central Express", number: "TF002", color: "blue", stops: ["Majestic", "Shivajinagar", "Vasanth Nagar", "Cantonment", "Hebbal"] },
  { name: "South Connect", number: "TF003", color: "orange", stops: ["Majestic", "Lalbagh", "Jayanagar", "JP Nagar", "Banashankari"] },
  { name: "East Link", number: "TF004", color: "green", stops: ["Majestic", "Indiranagar", "KR Puram", "Whitefield"] },
  { name: "Tech Corridor", number: "TF005", color: "pink", stops: ["Shivajinagar", "MG Road", "Domlur", "Marathahalli", "Whitefield"] }
];

async function main() {
  await connectDB();
  const city = await City.findOneAndUpdate(
    { name: "Bengaluru", state: "Karnataka", country: "India" },
    { name: "Bengaluru", state: "Karnataka", country: "India", code: "BLR" },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const names = [...new Set(sampleRoutes.flatMap(r => r.stops))];
  const docs = {};
  for (const name of names) docs[name] = await Stop.findOneAndUpdate(
    { city: city._id, name }, { city: city._id, name, active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  for (const r of sampleRoutes) await Route.findOneAndUpdate(
    { city: city._id, name: r.name },
    { city: city._id, name: r.name, routeNumber: r.number, busNumber: r.number, color: r.color, active: true, stops: r.stops.map(n => docs[n]._id) },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  console.log(`Seeded Bengaluru demo data: ${names.length} stops, ${sampleRoutes.length} routes. Not official BMTC data.`);
  await mongoose.disconnect();
}
main().catch(async e => { console.error(e); await mongoose.disconnect(); process.exit(1); });
