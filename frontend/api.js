/* TransitFlow frontend API helper */
(() => {
  const API_BASE_URL = "http://localhost:5000/api";

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Server returned an invalid response (${response.status}).`);
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || `API request failed (${response.status}).`);
    }

    return result.data ?? result;
  }

  window.TransitAPI = {
    getCities() {
      return request("/cities");
    },
    getStops(cityId) {
      const query = cityId ? `?city=${encodeURIComponent(cityId)}` : "";
      return request(`/stops${query}`);
    },
    getRoutes(cityId) {
      const query = cityId ? `?city=${encodeURIComponent(cityId)}` : "";
      return request(`/routes${query}`);
    },
    findJourneyByName(from, to, cityId) {
      return request("/journey/by-name", {
        method: "POST",
        body: JSON.stringify({ from, to, city: cityId })
      });
    },
    health() {
      return request("/health");
    }
  };
})();
