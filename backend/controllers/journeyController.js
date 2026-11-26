const Route = require("../models/Route");
const Stop = require("../models/Stop");
const wrap = require("../middleware/asyncHandler");

/* BFS where each edge is one bus ride between two stops on the same active route.
   This minimizes bus boardings; a transfer is one fewer than the number of buses. */
function bfs(sourceId, destinationId, routes) {
  const routesAtStop = new Map();
  for (const route of routes) {
    for (const stop of route.stops) {
      const id = String(stop._id);
      if (!routesAtStop.has(id)) routesAtStop.set(id, []);
      routesAtStop.get(id).push(route);
    }
  }
  const queue = [sourceId];
  const visited = new Set([sourceId]);
  const previous = new Map();

  while (queue.length) {
    const current = queue.shift();
    if (current === destinationId) break;
    for (const route of (routesAtStop.get(current) || [])) {
      for (const stop of route.stops) {
        const next = String(stop._id);
        if (visited.has(next)) continue;
        visited.add(next);
        previous.set(next, { from: current, route });
        queue.push(next);
      }
    }
  }
  if (!visited.has(destinationId)) return null;

  const edges = [];
  let cursor = destinationId;
  while (cursor !== sourceId) {
    const step = previous.get(cursor);
    if (!step) return null;
    edges.push({ from: step.from, to: cursor, route: step.route });
    cursor = step.from;
  }
  edges.reverse();

  const legs = [];
  for (const edge of edges) {
    const last = legs[legs.length - 1];
    if (last && String(last.route._id) === String(edge.route._id) && last.toId === edge.from) {
      last.toId = edge.to;
    } else {
      legs.push({ route: edge.route, fromId: edge.from, toId: edge.to });
    }
  }
  return { buses: legs.length, transfers: Math.max(0, legs.length - 1), legs };
}

exports.plan = wrap(async (req, res) => {
  const source = String(req.body.source || req.query.source || "");
  const destination = String(req.body.destination || req.query.destination || "");
  const cityId = req.body.city || req.query.city;
  if (!source || !destination) return res.status(400).json({ success: false, message: "source and destination stop IDs are required." });
  if (source === destination) return res.json({ success: true, data: { buses: 0, transfers: 0, legs: [], message: "You are already at your destination." } });

  const filter = { _id: { $in: [source, destination] }, active: true };
  if (cityId) filter.city = cityId;
  const endpoints = await Stop.find(filter);
  if (endpoints.length !== 2) return res.status(404).json({ success: false, message: "Source or destination stop was not found or is inactive." });
  if (String(endpoints[0].city) !== String(endpoints[1].city)) return res.status(400).json({ success: false, message: "Stops must belong to the same city." });

  const network = await Route.find({ city: endpoints[0].city, active: true })
    .populate({ path: "stops", match: { active: true }, select: "name latitude longitude active" });
  const usable = network.filter(route => route.stops.length >= 2);
  const result = bfs(source, destination, usable);
  if (!result) return res.status(404).json({ success: false, message: "No journey found using currently active routes." });

  const stopMap = new Map();
  for (const route of usable) for (const stop of route.stops) stopMap.set(String(stop._id), stop);
  const data = {
    buses: result.buses,
    transfers: result.transfers,
    legs: result.legs.map(leg => ({
      route: { id: leg.route._id, name: leg.route.name, routeNumber: leg.route.routeNumber || leg.route.busNumber, color: leg.route.color },
      from: stopMap.get(leg.fromId),
      to: stopMap.get(leg.toId)
    }))
  };
  res.json({ success: true, data });
});

exports.planByName = wrap(async (req, res) => {
  const { from, to, city } = req.body;
  if (!from || !to || !city) return res.status(400).json({ success: false, message: "from, to and city are required." });
  const safe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const [source, destination] = await Promise.all([
    Stop.findOne({ name: new RegExp(`^${safe(from)}$`, "i"), city, active: true }),
    Stop.findOne({ name: new RegExp(`^${safe(to)}$`, "i"), city, active: true })
  ]);
  if (!source || !destination) return res.status(404).json({ success: false, message: "Could not find both active stops." });
  req.body.source = String(source._id);
  req.body.destination = String(destination._id);
  req.body.city = String(city);
  return exports.plan(req, res);
});
