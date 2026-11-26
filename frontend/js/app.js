
const STORAGE_KEY = "transitflow_network_v1";

const $ = id => document.getElementById(id);

const COLORS = {
  teal: "#0d9488",
  blue: "#4b9ed0",
  orange: "#e5a04c",
  green: "#36a77c",
  pink: "#d66b9a"
};

const DEMO_ROUTES = [
  {
    id: "TF001",
    name: "Purple Corridor",
    color: "teal",
    active: true,
    stops: [
      "Majestic",
      "Vijayanagar",
      "Attiguppe",
      "Deepanjali Nagar",
      "Mysore Road"
    ]
  },
  {
    id: "TF002",
    name: "Central Express",
    color: "blue",
    active: true,
    stops: [
      "Majestic",
      "Shivajinagar",
      "Vasanth Nagar",
      "Cantonment",
      "Hebbal"
    ]
  },
  {
    id: "TF003",
    name: "South Connect",
    color: "orange",
    active: true,
    stops: [
      "Majestic",
      "Lalbagh",
      "Jayanagar",
      "JP Nagar",
      "Banashankari"
    ]
  },
  {
    id: "TF004",
    name: "Tech Park Line",
    color: "green",
    active: true,
    stops: [
      "Shivajinagar",
      "MG Road",
      "Indiranagar",
      "Marathahalli",
      "Whitefield"
    ]
  },
  {
    id: "TF005",
    name: "Airport Connector",
    color: "pink",
    active: true,
    stops: [
      "Hebbal",
      "Yelahanka",
      "Airport Road",
      "Kempegowda Airport"
    ]
  },
  {
    id: "TF006",
    name: "East-West Link",
    color: "teal",
    active: true,
    stops: [
      "Mysore Road",
      "Majestic",
      "MG Road",
      "Indiranagar"
    ]
  }
];

const COORDINATES = {
  "Majestic": [12.9767, 77.5713],
  "Vijayanagar": [12.9700, 77.5370],
  "Attiguppe": [12.9630, 77.5480],
  "Deepanjali Nagar": [12.9560, 77.5420],
  "Mysore Road": [12.9460, 77.5300],
  "Shivajinagar": [12.9850, 77.6050],
  "Vasanth Nagar": [12.9910, 77.5900],
  "Cantonment": [12.9900, 77.6000],
  "Hebbal": [13.0350, 77.5970],
  "Lalbagh": [12.9507, 77.5848],
  "Jayanagar": [12.9250, 77.5838],
  "JP Nagar": [12.9100, 77.5850],
  "Banashankari": [12.9250, 77.5650],
  "MG Road": [12.9750, 77.6060],
  "Indiranagar": [12.9784, 77.6408],
  "Marathahalli": [12.9560, 77.7010],
  "Whitefield": [12.9698, 77.7499],
  "Yelahanka": [13.1007, 77.5963],
  "Airport Road": [13.1500, 77.6200],
  "Kempegowda Airport": [13.1986, 77.7066]
};

let routes = [];
let stops = [];
let map = null;
let markers = [];
let routeLayers = [];
let journeyLayer = null;
let busesVisible = true;
let excluded = new Set();
let currentFilter = "all";
let bfsRunning = false;

// Backend state: the Bengaluru city ID is needed by the journey API.
let backendCityId = null;
let backendConnected = false;


function getRecordId(record) {
  return record?._id || record?.id || record?.cityId || "";
}

function getRecordName(record) {
  return record?.name || record?.stopName || record?.cityName || "";
}

function mapBackendRoute(route) {
  const routeStops = Array.isArray(route.stops) ? route.stops : [];
  return {
    id: String(route._id || route.id || route.routeNumber || route.name),
    name: route.name || route.routeName || "Unnamed route",
    color: route.color || "teal",
    active: route.active !== false,
    stops: routeStops.map(stop =>
      typeof stop === "string" ? stop : (stop?.name || stop?.stopName || "")
    ).filter(Boolean)
  };
}

async function loadBackendData() {
  if (!window.TransitAPI) {
    throw new Error("API helper was not loaded. Check frontend/api.js.");
  }

  const [cities] = await Promise.all([TransitAPI.getCities()]);
  const cityList = Array.isArray(cities) ? cities : [];
  const city = cityList.find(item =>
    /bengaluru|bangalore/i.test(getRecordName(item))
  ) || cityList[0];

  if (!city) {
    throw new Error("No city was returned by the backend.");
  }

  backendCityId = getRecordId(city);
  if (!backendCityId) {
    throw new Error("The selected city response has no ID.");
  }

  const [backendStops, backendRoutes] = await Promise.all([
    TransitAPI.getStops(backendCityId),
    TransitAPI.getRoutes(backendCityId)
  ]);

  const stopList = Array.isArray(backendStops) ? backendStops : [];
  const routeList = Array.isArray(backendRoutes) ? backendRoutes : [];

  routes = routeList.map(mapBackendRoute);
  updateStops();

  // If the API returns stop records that are not referenced by a route,
  // keep them available in the stop selectors too.
  stopList.forEach(stop => {
    const name = getRecordName(stop);
    if (name && !stops.includes(name)) stops.push(name);
  });
  stops.sort((a, b) => a.localeCompare(b));

  if (!routes.length || !stops.length) {
    throw new Error("The backend returned no route or stop data.");
  }

  backendConnected = true;
  saveData();
}

function mapBackendJourney(data, source, destination) {
  const rawLegs = Array.isArray(data?.legs) ? data.legs : [];
  const legs = rawLegs.map(leg => {
    const route = leg.route || {};
    return {
      routeName: route.name || route.routeName || "Bus route",
      routeId: String(route._id || route.id || route.routeNumber || ""),
      color: route.color || "teal",
      from: typeof leg.from === "string" ? leg.from : (leg.from?.name || source),
      to: typeof leg.to === "string" ? leg.to : (leg.to?.name || destination)
    };
  });

  const stopSequence = [source];
  legs.forEach(leg => {
    if (leg.to && stopSequence[stopSequence.length - 1] !== leg.to) {
      stopSequence.push(leg.to);
    }
  });
  if (stopSequence[stopSequence.length - 1] !== destination) {
    stopSequence.push(destination);
  }

  const found = data?.found !== false &&
    (legs.length > 0 || source === destination || Number(data?.buses) > 0);

  return {
    found,
    message: data?.message || "No available journey connects these stops.",
    source,
    destination,
    busCount: Number.isFinite(Number(data?.buses))
      ? Number(data.buses)
      : legs.length,
    legs,
    stopSequence,
    interchangeStops: legs.slice(0, -1).map(leg => leg.to)
  };
}

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

function toast(message) {
  const element = $("toast");
  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.classList.remove("show");
  }, 2600);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    routes = saved ? JSON.parse(saved) : structuredClone(DEMO_ROUTES);

    if (!Array.isArray(routes)) {
      routes = structuredClone(DEMO_ROUTES);
    }
  } catch {
    routes = structuredClone(DEMO_ROUTES);
  }

  saveData();
  updateStops();
}

function resetData() {
  if (!confirm("Restore the original TransitFlow demonstration network?")) {
    return;
  }

  routes = structuredClone(DEMO_ROUTES);
  excluded.clear();

  saveData();
  updateStops();
  renderAll();

  if (map) {
    setTimeout(() => map.invalidateSize(), 100);
  }

  toast("Demo network restored");
}

function updateStops() {
  const names = new Set();

  routes.forEach(route => {
    route.stops.forEach(name => names.add(name));
  });

  stops = [...names].sort((a, b) => a.localeCompare(b));
}

function getCoordinates(name) {
  if (COORDINATES[name]) {
    return COORDINATES[name];
  }

  const index = stops.indexOf(name);
  const offset = Math.max(index, 0);

  return [
    12.9716 + Math.sin(offset * 2.4) * 0.025,
    77.5946 + Math.cos(offset * 2.4) * 0.035
  ];
}

function getColor(route) {
  return COLORS[route.color] || COLORS.teal;
}

function getInterchanges() {
  return stops.filter(stop =>
    routes.filter(route =>
      route.stops.includes(stop)
    ).length > 1
  );
}

function renderStats() {
  $("statRoutes").textContent = routes.filter(r => r.active).length;
  $("statStops").textContent = stops.length;
  $("statClosed").textContent = routes.filter(r => !r.active).length;

  $("mapRouteCount").textContent = routes.length;
  $("mapStopCount").textContent = stops.length;
  $("mapInterchangeCount").textContent = getInterchanges().length;
}

function populateSelect(element, selected) {
  if (!element) return;

  const previous = selected || element.value;

  element.innerHTML = stops.map(stop =>
    `<option value="${esc(stop)}">${esc(stop)}</option>`
  ).join("");

  if (stops.includes(previous)) {
    element.value = previous;
  }
}

function renderStopOptions() {
  [
    "quickSource",
    "quickDestination",
    "sourceStop",
    "destinationStop",
    "bfsSource",
    "bfsDestination"
  ].forEach(id => {
    const element = $(id);
    if (element) populateSelect(element);
  });

  if ($("quickSource") && stops.length > 1) {
    $("quickSource").value = stops[0];
    $("quickDestination").value = stops[stops.length - 1];
  }

  if ($("sourceStop") && stops.length > 1) {
    $("sourceStop").value = stops[0];
    $("destinationStop").value = stops[stops.length - 1];
  }

  if ($("bfsSource") && stops.length > 1) {
    $("bfsSource").value = stops[0];
    $("bfsDestination").value = stops[stops.length - 1];
  }
}

function renderOverviewRoutes() {
  $("overviewRoutes").innerHTML = routes.map(route => `
    <div class="route-row">
      <span class="route-color"
        style="background:${getColor(route)}"></span>
      <div>
        <strong>${esc(route.name)}</strong>
        <small>${route.stops.map(esc).join(" → ")}</small>
      </div>
      <span class="status-dot ${route.active ? "" : "off"}"></span>
    </div>
  `).join("") || "<p>No routes available.</p>";
}

function renderInactiveOptions() {
  $("inactiveOptions").innerHTML = routes.map(route => `
    <label class="inactive-option">
      <input type="checkbox"
        value="${esc(route.id)}"
        ${excluded.has(route.id) ? "checked" : ""}
        ${route.active ? "" : "disabled"}>
      ${esc(route.name)}
      ${route.active ? "" : "(Already inactive)"}
    </label>
  `).join("");

  $("inactiveOptions").querySelectorAll("input").forEach(input => {
    input.addEventListener("change", () => {
      if (input.checked) excluded.add(input.value);
      else excluded.delete(input.value);

      renderInactiveOptions();
    });
  });
}

function renderNetwork() {
  const query = ($("routeSearch").value || "").toLowerCase();

  const filtered = routes.filter(route => {
    const matchesSearch = [
      route.name,
      route.id,
      ...route.stops
    ].join(" ").toLowerCase().includes(query);

    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "active" && route.active) ||
      (currentFilter === "inactive" && !route.active);

    return matchesSearch && matchesFilter;
  });

  $("networkGrid").innerHTML = filtered.map(route => `
    <article class="network-card">
      <div class="network-card-top">
        <span class="route-color"
          style="background:${getColor(route)}"></span>

        <div>
          <h3>${esc(route.name)}</h3>
          <small>${esc(route.id)} · ${route.stops.length} stops</small>
        </div>

        <span class="route-status ${route.active ? "" : "inactive"}">
          ${route.active ? "ACTIVE" : "INACTIVE"}
        </span>
      </div>

      <div class="network-stops">
        ${route.stops.map(esc).join(" → ")}
      </div>

      <div class="network-card-footer">
        <span>${route.active ? "Service available" : "Service unavailable"}</span>

        <div class="card-actions">
          <button class="small-action"
            data-edit="${esc(route.id)}">Edit</button>

          <button class="small-action"
            data-toggle="${esc(route.id)}">
            ${route.active ? "Disable" : "Enable"}
          </button>

          <button class="small-action"
            data-delete="${esc(route.id)}">Delete</button>
        </div>
      </div>
    </article>
  `).join("") || `
    <div class="no-routes">No matching routes found.</div>
  `;
}

function renderAll() {
  updateStops();
  renderStats();
  renderStopOptions();
  renderOverviewRoutes();
  renderInactiveOptions();
  renderNetwork();
  renderMap();
}

function setupMap() {
  if (!window.L || !$("bengaluruMap")) {
    toast("Leaflet map library could not load.");
    return;
  }

  map = L.map("bengaluruMap", {
    zoomControl: true
  }).setView([12.9716, 77.5946], 11);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      maxZoom: 19
    }
  ).addTo(map);

  setTimeout(() => map.invalidateSize(), 250);
}

function clearMap() {
  if (!map) return;

  markers.forEach(marker => map.removeLayer(marker));
  routeLayers.forEach(layer => map.removeLayer(layer));

  markers = [];
  routeLayers = [];

  if (journeyLayer) {
    map.removeLayer(journeyLayer);
    journeyLayer = null;
  }
}

function renderMap() {
  if (!map) return;

  clearMap();

  if (busesVisible) {
    routes.filter(route => route.active).forEach(route => {
      const points = route.stops.map(getCoordinates);

      const layer = L.polyline(points, {
        color: getColor(route),
        weight: 4,
        opacity: 0.75
      }).addTo(map);

      layer.bindTooltip(esc(route.name));
      routeLayers.push(layer);
    });
  }

  stops.forEach(stop => {
    const point = getCoordinates(stop);

    const interchange = getInterchanges().includes(stop);

    const marker = L.circleMarker(point, {
      radius: interchange ? 7 : 5,
      color: interchange ? "#e5a04c" : "#0d9488",
      fillColor: "#ffffff",
      fillOpacity: 1,
      weight: 3
    }).addTo(map);

    marker.bindPopup(`
      <strong>${esc(stop)}</strong>
      <br>
      <small>${interchange ? "Interchange hub" : "Bus stop"}</small>
    `);

    markers.push(marker);
  });

  const points = stops.map(getCoordinates);

  if (points.length) {
    map.fitBounds(points, {
      padding: [25, 25],
      maxZoom: 12
    });
  }

  setTimeout(() => map.invalidateSize(), 100);
}

function fitMap() {
  if (!map) return;

  const points = stops.map(getCoordinates);

  if (points.length) {
    map.fitBounds(points, {
      padding: [30, 30],
      maxZoom: 12
    });
  }
}

function drawJourney(result) {
  if (!map || !result.found) return;

  if (journeyLayer) {
    map.removeLayer(journeyLayer);
  }

  const points = result.stopSequence.map(getCoordinates);

  journeyLayer = L.polyline(points, {
    color: "#0d9488",
    weight: 7,
    opacity: 0.95
  }).addTo(map);

  map.fitBounds(journeyLayer.getBounds(), {
    padding: [40, 40]
  });

  setTimeout(() => map.invalidateSize(), 100);
}

function findJourney(source, destination, excludedRoutes = new Set()) {
  if (!stops.includes(source) || !stops.includes(destination)) {
    return { found: false, message: "Please select valid bus stops." };
  }

  if (source === destination) {
    return {
      found: true,
      busCount: 0,
      source,
      destination,
      legs: [],
      stopSequence: [source],
      interchangeStops: []
    };
  }

  const activeRoutes = routes.filter(route =>
    route.active && !excludedRoutes.has(route.id)
  );

  const queue = [source];
  const visited = new Set([source]);
  const parent = new Map();

  let found = false;

  while (queue.length) {
    const current = queue.shift();

    for (const route of activeRoutes) {
      const index = route.stops.indexOf(current);

      if (index === -1) continue;

      for (const next of route.stops) {
        if (visited.has(next)) continue;

        visited.add(next);

        parent.set(next, {
          previous: current,
          route
        });

        if (next === destination) {
          found = true;
          break;
        }

        queue.push(next);
      }

      if (found) break;
    }

    if (found) break;
  }

  if (!found) {
    return {
      found: false,
      message: "No available journey connects these stops. Try another route or enable more bus services."
    };
  }

  const path = [];
  let current = destination;

  while (current !== source) {
    const step = parent.get(current);

    if (!step) {
      return { found: false, message: "Unable to reconstruct journey." };
    }

    path.push({
      from: step.previous,
      to: current,
      route: step.route
    });

    current = step.previous;
  }

  path.reverse();

  const legs = [];

  path.forEach(step => {
    const previousLeg = legs[legs.length - 1];

    if (previousLeg && previousLeg.route.id === step.route.id) {
      previousLeg.to = step.to;
    } else {
      legs.push({
        routeName: step.route.name,
        routeId: step.route.id,
        color: step.route.color,
        from: step.from,
        to: step.to
      });
    }
  });

  const stopSequence = [source];

  legs.forEach(leg => stopSequence.push(leg.to));

  const interchangeStops = legs
    .slice(0, -1)
    .map(leg => leg.to);

  return {
    found: true,
    source,
    destination,
    busCount: legs.length,
    legs,
    stopSequence,
    interchangeStops
  };
}

function renderJourney(result) {
  const panel = $("journeyResult");

  if (!result.found) {
    panel.innerHTML = `
      <div class="empty-result">
        <div class="empty-illustration">!</div>
        <h2>No available journey</h2>
        <p>${esc(result.message)}</p>
      </div>
    `;
    return;
  }

  if (result.busCount === 0) {
    panel.innerHTML = `
      <div class="journey-head">
        <div>
          <div class="eyebrow">JOURNEY COMPLETE</div>
          <h2>You're already there!</h2>
          <p>${esc(result.source)}</p>
        </div>
        <span class="bus-count">0 BUSES</span>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="journey-head">
      <div>
        <div class="eyebrow">YOUR RECOMMENDED JOURNEY</div>
        <h2>${esc(result.source)} → ${esc(result.destination)}</h2>
        <p>${result.legs.length} bus service(s) required</p>
      </div>

      <span class="bus-count">
        ${result.busCount} ${result.busCount === 1 ? "BUS" : "BUSES"}
      </span>
    </div>

    <div class="journey-stops">
      ${result.stopSequence.map((stop, index) => `
        <div class="journey-stop ${
          index === result.stopSequence.length - 1 ? "final" :
          index > 0 ? "interchange" : ""
        }">
          <span class="stop-marker">${index === 0 ? "A" :
            index === result.stopSequence.length - 1 ? "B" : "↔"}</span>

          <div class="stop-info">
            <strong>${esc(stop)}</strong>
            <small>${
              index === 0 ? "Starting point" :
              index === result.stopSequence.length - 1 ? "Destination" :
              "Change bus here"
            }</small>
          </div>
        </div>
      `).join("")}
    </div>

    ${result.legs.map((leg, index) => `
      <div class="bus-leg">
        <span class="bus-pill">🚌</span>
        <div>
          <strong>${esc(leg.routeName)}</strong>
          <small>${esc(leg.from)} → ${esc(leg.to)}</small>
        </div>
        <span class="status-dot" style="background:${COLORS[leg.color] || COLORS.teal}"></span>
      </div>
    `).join("")}

    <div class="journey-explanation">
      <strong>✓ BFS optimized journey</strong><br>
      ${result.busCount} bus service(s) required.
      ${
        result.interchangeStops.length
          ? "Change buses at " + result.interchangeStops.map(esc).join(", ") + "."
          : "No bus changes required."
      }
      <br>Route-level demonstration data; not live BMTC arrival information.
    </div>
  `;

  drawJourney(result);
}

async function calculateJourney(source, destination) {
  let result;

  if (backendConnected && backendCityId) {
    try {
      if (excluded.size) {
        toast("The backend journey endpoint does not support excluded routes; calculating with all active backend routes.");
      }
      const data = await TransitAPI.findJourneyByName(
        source,
        destination,
        backendCityId
      );
      result = mapBackendJourney(data, source, destination);
    } catch (error) {
      console.error("Backend journey request failed:", error);
      result = findJourney(source, destination, excluded);
      toast("Backend journey failed; showing the local BFS result.");
    }
  } else {
    result = findJourney(source, destination, excluded);
  }

  renderJourney(result);

  if (!result.found) {
    toast("No available journey found");
  } else {
    toast(backendConnected
      ? "Journey calculated using the backend"
      : "Journey calculated using local demo data");
  }

  return result;
}

function openRouteModal(route = null) {
  $("routeForm").reset();

  $("editingRouteId").value = route?.id || "";
  $("modalTitle").textContent = route ? "Edit bus route" : "Add a bus route";

  $("routeName").value = route?.name || "";
  $("routeColor").value = route?.color || "teal";
  $("routeStops").value = route?.stops.join(", ") || "";

  $("routeModal").classList.add("open");
}

function closeRouteModal() {
  $("routeModal").classList.remove("open");
}

function saveRoute(event) {
  event.preventDefault();

  const id = $("editingRouteId").value;
  const name = $("routeName").value.trim();
  const color = $("routeColor").value;

  const routeStops = $("routeStops").value
    .split(",")
    .map(stop => stop.trim())
    .filter(Boolean);

  const uniqueStops = [...new Set(routeStops)];

  if (uniqueStops.length < 2) {
    toast("A route must contain at least two different stops.");
    return;
  }

  const existing = routes.find(route =>
    route.name.toLowerCase() === name.toLowerCase() &&
    route.id !== id
  );

  if (existing) {
    toast("A route with this name already exists.");
    return;
  }

  if (id) {
    const route = routes.find(item => item.id === id);

    if (!route) return;

    route.name = name;
    route.color = color;
    route.stops = uniqueStops;

    toast("Route updated successfully");
  } else {
    routes.push({
      id: "TF" + Date.now().toString().slice(-8),
      name,
      color,
      active: true,
      stops: uniqueStops
    });

    toast("New route added successfully");
  }

  saveData();
  excluded.clear();
  closeRouteModal();
  renderAll();
}

function toggleRoute(id) {
  const route = routes.find(item => item.id === id);
  if (!route) return;

  route.active = !route.active;

  saveData();
  renderAll();

  toast(`${route.name} ${route.active ? "enabled" : "disabled"}`);
}

function deleteRoute(id) {
  const route = routes.find(item => item.id === id);
  if (!route) return;

  if (!confirm(`Delete ${route.name} permanently?`)) return;

  routes = routes.filter(item => item.id !== id);
  excluded.delete(id);

  saveData();
  renderAll();

  toast("Route deleted");
}

function exportData() {
  const data = {
    application: "TransitFlow",
    city: "Bengaluru",
    exportedAt: new Date().toISOString(),
    routes,
    stops: stops.map(name => ({
      name,
      coordinates: getCoordinates(name)
    }))
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "transitflow-network.json";
  link.click();

  URL.revokeObjectURL(url);

  toast("Network data exported");
}

async function runBFS() {
  if (bfsRunning) return;

  const source = $("bfsSource").value;
  const destination = $("bfsDestination").value;

  const result = findJourney(source, destination, excluded);

  const steps = $("bfsSteps");
  const status = $("bfsStatus");
  const output = $("bfsResult");

  steps.innerHTML = "";
  output.innerHTML = "";

  if (!result.found) {
    status.textContent = "No available path found";
    output.textContent = result.message;
    return;
  }

  bfsRunning = true;
  $("runBfs").disabled = true;

  const queue = [source];
  const visited = new Set([source]);
  const activeRoutes = routes.filter(route =>
    route.active && !excluded.has(route.id)
  );

  let found = false;

  status.textContent = "Exploring the network...";

  while (queue.length && !found) {
    const current = queue.shift();

    const card = document.createElement("div");
    card.className = "bfs-step current";
    card.innerHTML = `
      <b>${esc(current)}</b>
      <small>Currently exploring</small>
    `;

    steps.appendChild(card);

    await new Promise(resolve => setTimeout(resolve, 450));

    card.classList.remove("current");
    card.classList.add(
      current === destination ? "destination" : "visited"
    );

    card.querySelector("small").textContent = "Visited";

    if (current === destination) {
      found = true;
      break;
    }

    for (const route of activeRoutes) {
      if (!route.stops.includes(current)) continue;

      for (const next of route.stops) {
        if (visited.has(next)) continue;

        visited.add(next);
        queue.push(next);

        if (next === destination) {
          found = true;
          break;
        }
      }

      if (found) break;
    }
  }

  status.textContent = found
    ? "Destination discovered!"
    : "Search completed";

  output.innerHTML = found
    ? `<strong>✓ Minimum buses: ${result.busCount}</strong><br>
       Journey: ${result.stopSequence.map(esc).join(" → ")}`
    : "No journey available.";

  bfsRunning = false;
  $("runBfs").disabled = false;

  renderJourney(result);
}

function showView(name) {
  const views = document.querySelectorAll(".view");

  views.forEach(view => view.classList.remove("active"));

  const target = $(name + "View");

  if (!target) return;

  target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === name
    );
  });

  const titles = {
    overview: "Overview",
    planner: "Journey planner",
    network: "Route network",
    algorithm: "BFS explorer"
  };

  $("breadcrumbTitle").textContent = titles[name] || "Overview";

  $("sidebar").classList.remove("open");

  if (name === "overview" && map) {
    setTimeout(() => map.invalidateSize(), 150);
  }
}

function updateClock() {
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  }).format(new Date());

  if ($("systemClock")) {
    $("systemClock").textContent = `Bengaluru · ${time}`;
  }
}

function setupEvents() {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      showView(button.dataset.go);
    });
  });

  $("mobileMenu").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("quickForm").addEventListener("submit", async event => {
    event.preventDefault();

    const result = await calculateJourney(
      $("quickSource").value,
      $("quickDestination").value
    );

    if (result.found) showView("planner");
  });

  $("plannerForm").addEventListener("submit", async event => {
    event.preventDefault();

    await calculateJourney(
      $("sourceStop").value,
      $("destinationStop").value
    );
  });

  $("swapStops").addEventListener("click", () => {
    const source = $("sourceStop").value;

    $("sourceStop").value = $("destinationStop").value;
    $("destinationStop").value = source;
  });

  $("routeSearch").addEventListener("input", renderNetwork);

  document.querySelectorAll(".filter-tab").forEach(button => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;

      document.querySelectorAll(".filter-tab").forEach(tab =>
        tab.classList.toggle("active", tab === button)
      );

      renderNetwork();
    });
  });

  $("addRouteButton").addEventListener("click", () => {
    openRouteModal();
  });

  $("routeForm").addEventListener("submit", saveRoute);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", closeRouteModal);
  });

  $("routeModal").addEventListener("click", event => {
    if (event.target === $("routeModal")) {
      closeRouteModal();
    }
  });

  $("networkGrid").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const toggle = event.target.closest("[data-toggle]");
    const del = event.target.closest("[data-delete]");

    if (edit) {
      const route = routes.find(item => item.id === edit.dataset.edit);
      if (route) openRouteModal(route);
    }

    if (toggle) toggleRoute(toggle.dataset.toggle);
    if (del) deleteRoute(del.dataset.delete);
  });

  $("closureButton").addEventListener("click", () => {
    const inactive = routes.filter(route => !route.active);

    if (inactive.length) {
      const restore = confirm(
        `${inactive.length} route(s) are inactive. Restore all inactive routes?`
      );

      if (restore) {
        routes.forEach(route => route.active = true);
        excluded.clear();
        saveData();
        renderAll();
        toast("All bus services restored");
      }
    } else {
      const active = routes.filter(route => route.active);

      if (!active.length) return;

      const selected = prompt(
        "Enter the route name to disable:\n" +
        active.map(route => route.name).join("\n")
      );

      const route = routes.find(item =>
        item.name.toLowerCase() === String(selected || "").trim().toLowerCase()
      );

      if (route) toggleRoute(route.id);
      else if (selected) toast("Route not found");
    }
  });

  $("exportData").addEventListener("click", exportData);
  $("resetData").addEventListener("click", resetData);

  $("fitMap").addEventListener("click", fitMap);

  $("toggleBuses").addEventListener("click", () => {
    busesVisible = !busesVisible;

    $("toggleBuses").textContent = busesVisible
      ? "◉ Buses on"
      : "◉ Buses off";

    $("toggleBuses").classList.toggle("active", busesVisible);

    renderMap();
  });

  $("runBfs").addEventListener("click", runBFS);

  $("helpButton").addEventListener("click", () => {
    alert(
      "TransitFlow uses Breadth-First Search (BFS) to find a journey with the fewest buses. Shared stops act as interchange points. You can disable a route and calculate an alternative journey."
    );
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeRouteModal();
  });
}

async function init() {
  try {
    await loadBackendData();
    toast("Connected to TransitFlow backend");
  } catch (error) {
    console.error("Could not load backend data:", error);
    backendConnected = false;
    loadData();
    toast("Backend unavailable — using saved demo data");
  }

  setupMap();
  setupEvents();
  renderAll();
  updateClock();

  setInterval(updateClock, 30000);

  if (map) {
    setTimeout(() => map.invalidateSize(), 300);
  }
}

document.addEventListener("DOMContentLoaded", init);
