const { BaseClient } = require("./BaseClient");

/**
 * Example external API client.
 * Extend BaseClient for each external service your application consumes.
 *
 * Usage pattern:
 *   - Instantiate with the external API's base URL and auth headers.
 *   - Expose domain-specific methods that wrap the HTTP verbs.
 *   - Consumed exclusively by the services layer, never by controllers directly.
 */
class ExampleExternalClient extends BaseClient {
  constructor() {
    super("https://api.example.com", {
      Authorization: "Bearer <token>",
    });
  }

  async getResourceById(resourceId) {
    return this.get(`/resources/${resourceId}`);
  }

  async createResource(payload) {
    return this.post("/resources", payload);
  }

  async updateResource(resourceId, payload) {
    return this.put(`/resources/${resourceId}`, payload);
  }

  async deleteResource(resourceId) {
    return this.delete(`/resources/${resourceId}`);
  }
}

module.exports = { ExampleExternalClient };
