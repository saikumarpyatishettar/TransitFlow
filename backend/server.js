require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();
const origins = (process.env.CLIENT_ORIGIN || "*").split(",").map(s => s.trim());
app.use(helmet());
app.use(cors({ origin(origin, cb) {
  if (!origin || origins.includes("*") || origins.includes(origin)) return cb(null, true);
  return cb(new Error("Origin is not allowed by CORS."));
}}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

app.get("/", (req, res) => res.json({ success: true, name: "TransitFlow API", endpoints: ["/api/health", "/api/cities", "/api/stops", "/api/routes", "/api/journey"] }));
app.get("/api/health", (req, res) => res.json({ success: true, database: require("mongoose").connection.readyState === 1 ? "connected" : "disconnected" }));
app.use("/api/cities", require("./routes/cityRoutes"));
app.use("/api/stops", require("./routes/stopRoutes"));
app.use("/api/routes", require("./routes/busRoutes"));
app.use("/api/journey", require("./routes/journeyRoutes"));
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
connectDB().then(() => app.listen(port, () => console.log(`TransitFlow API running at http://localhost:${port}`)))
  .catch(err => { console.error("Backend startup failed:", err.message); process.exit(1); });
