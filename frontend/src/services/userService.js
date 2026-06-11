import { api } from "./api";

/**
 * UserService handles all API communication related to users.
 *
 * Pattern:
 *   - One service file per backend resource/domain.
 *   - Each method maps to a backend endpoint.
 *   - Services are consumed by hooks or pages, never by components directly.
 */
export const UserService = {
  getAll(params) {
    return api.get("/users", { params });
  },

  getById(id) {
    return api.get(`/users/${id}`);
  },

  create(data) {
    return api.post("/users", data);
  },

  update(id, data) {
    return api.put(`/users/${id}`, data);
  },

  delete(id) {
    return api.delete(`/users/${id}`);
  },
};
