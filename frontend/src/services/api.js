const API_BASE_URL = "http://localhost:3000/api/v1";

/**
 * Base API service for all HTTP communication with the backend.
 * All service modules should use these methods instead of calling fetch directly.
 */
async function request(method, endpoint, { body, headers, params } = {}) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const token = localStorage.getItem("token");

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint, options) => request("GET", endpoint, options),
  post: (endpoint, body, options) => request("POST", endpoint, { ...options, body }),
  put: (endpoint, body, options) => request("PUT", endpoint, { ...options, body }),
  patch: (endpoint, body, options) => request("PATCH", endpoint, { ...options, body }),
  delete: (endpoint, options) => request("DELETE", endpoint, options),
};
