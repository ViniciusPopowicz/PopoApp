const { logger } = require("../utils");

/**
 * Base HTTP client for external API communication.
 * All external API calls must go through a client module.
 *
 * Each client encapsulates:
 *   - Base URL and default headers for its external API
 *   - Request/response transformation
 *   - Error handling specific to the external API
 */
class BaseClient {
  constructor(baseURL, defaultHeaders = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...defaultHeaders,
    };
  }

  async request(method, path, { body, headers, params } = {}) {
    const url = new URL(path, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const options = {
      method,
      headers: { ...this.defaultHeaders, ...headers },
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      options.body = JSON.stringify(body);
    }

    logger.info(`External API request: ${method} ${url.toString()}`);

    const response = await fetch(url.toString(), options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(`External API error: ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.responseData = data;
      throw error;
    }

    return data;
  }

  async get(path, options = {}) {
    return this.request("GET", path, options);
  }

  async post(path, body, options = {}) {
    return this.request("POST", path, { ...options, body });
  }

  async put(path, body, options = {}) {
    return this.request("PUT", path, { ...options, body });
  }

  async patch(path, body, options = {}) {
    return this.request("PATCH", path, { ...options, body });
  }

  async delete(path, options = {}) {
    return this.request("DELETE", path, options);
  }
}

module.exports = { BaseClient };
