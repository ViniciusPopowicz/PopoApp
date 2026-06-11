import { api } from "./api";

const TOKEN_KEY = "token";

/**
 * AuthService handles all API communication and local state for authentication.
 *
 * Pattern:
 *   - One service file per backend resource/domain.
 *   - Each method maps to a backend endpoint or local storage operation.
 *   - Services are consumed by hooks or pages, never by components directly.
 */
export const AuthService = {
  /**
   * Authenticates a user and stores the JWT token in localStorage.
   *
   * @param {string} username - The username.
   * @param {string} password - The plain-text password.
   * @returns {Promise<Object>} The API response with token and user data.
   */
  async login(username, password) {
    const response = await api.post("/auth/login", { username, password });
    const { token } = response.data;

    localStorage.setItem(TOKEN_KEY, token);

    return response;
  },

  /**
   * Removes the JWT token from localStorage.
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
  },

  /**
   * Retrieves the stored JWT token.
   *
   * @returns {string|null} The token or null if not authenticated.
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Checks whether a valid token exists in localStorage.
   *
   * @returns {boolean} True if a token is stored.
   */
  isAuthenticated() {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token;
  },
};
