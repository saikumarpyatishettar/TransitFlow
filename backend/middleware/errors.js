function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Endpoint not found: ${req.method} ${req.originalUrl}`));
}
function errorHandler(err, req, res, next) {
  let status = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || "Internal server error";
  if (err.name === "ValidationError") {
    status = 400; message = Object.values(err.errors).map(e => e.message).join(", ");
  } else if (err.name === "CastError") {
    status = 400; message = "Invalid ID or value supplied.";
  } else if (err.code === 11000) {
    status = 409; message = "A record with the same unique value already exists.";
  }
  if (process.env.NODE_ENV !== "production") console.error(err);
  res.status(status).json({ success: false, message });
}
module.exports = { notFound, errorHandler };
