# TransitFlow Backend

REST API built with Node.js, Express and MongoDB/Mongoose.

## Requirements
- Node.js 18+
- MongoDB locally, or a MongoDB Atlas cluster

## Setup
1. Open a terminal in this folder and run `npm install`.
2. Copy `.env.example` to `.env`.
   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`
3. Set `MONGODB_URI` in `.env`.
   - Local: `mongodb://127.0.0.1:27017/transitflow`
   - Atlas: `mongodb+srv://USER:PASSWORD@CLUSTER/transitflow?retryWrites=true&w=majority`
4. Optional demo data: `npm run seed`.
5. Start: `npm run dev` (development) or `npm start`.
6. Check `http://localhost:5000/api/health`.

Never commit `.env` or share your MongoDB password.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET, POST | `/api/cities` | List/create cities |
| PUT, DELETE | `/api/cities/:id` | Update/delete city (also deletes its stops/routes) |
| GET, POST | `/api/stops` | List/create stops |
| PUT, DELETE | `/api/stops/:id` | Update/delete stop |
| GET, POST | `/api/routes` | List/create routes |
| GET, PUT, DELETE | `/api/routes/:id` | Read/update/delete route |
| PATCH | `/api/routes/:id/status` | Activate/deactivate route |
| GET, POST | `/api/journey` | Plan journey by stop IDs |
| POST | `/api/journey/by-name` | Plan journey by stop names |

### Create a city
`POST /api/cities`
```json
{ "name": "Bengaluru", "state": "Karnataka", "country": "India", "code": "BLR" }
```

### Create a stop
`POST /api/stops`
```json
{ "name": "Majestic", "city": "CITY_ID", "latitude": 12.9767, "longitude": 77.5713 }
```
The backend also accepts `lat` and `lng`.

### Create a route
`POST /api/routes`
```json
{
  "name": "Purple Corridor",
  "routeNumber": "TF001",
  "busNumber": "TF001",
  "city": "CITY_ID",
  "color": "teal",
  "active": true,
  "stops": ["STOP_ID_1", "STOP_ID_2", "STOP_ID_3"]
}
```
Stops must already exist, be active, and belong to the selected city. A route needs at least two stops.

### Deactivate a route
`PATCH /api/routes/ROUTE_ID/status`
```json
{ "active": false }
```

### Plan a journey by stop IDs
`POST /api/journey`
```json
{ "source": "SOURCE_STOP_ID", "destination": "DESTINATION_STOP_ID", "city": "CITY_ID" }
```

### Plan a journey by stop names
`POST /api/journey/by-name`
```json
{ "from": "Vijayanagar", "to": "Whitefield", "city": "CITY_ID" }
```

The planner uses BFS across active routes and minimizes bus boardings. It treats a route as bidirectional and assumes any two stops on the same route can be reached on that bus. Add direction/timetable modelling for real-world schedule accuracy.

## Frontend integration example
```js
const API_BASE = "http://localhost:5000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || "API request failed");
  return json.data;
}

const cities = await apiRequest("/cities");
const routes = await apiRequest("/routes");
```

For all four teammates to share the same data, deploy this API and use one shared MongoDB Atlas database. Change the frontend API base URL to the deployed server URL.

## Important
- This ZIP contains the backend only. It does not include or automatically modify your existing frontend files.
- Existing frontend fields may need a small adapter: route stops are stored as MongoDB ObjectIds and returned as populated stop objects.
- No authentication is included. Do not expose write endpoints publicly until authentication/authorization is added.
- Seed routes are illustrative Bengaluru demo data, not official BMTC routes.
