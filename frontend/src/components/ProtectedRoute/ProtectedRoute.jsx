import { Navigate, Outlet } from "react-router-dom";
import { AuthService } from "../../services";

/**
 * ProtectedRoute — Route guard that redirects unauthenticated users to /login.
 *
 * Usage:
 *   In the router config, wrap protected routes as children of a ProtectedRoute element.
 *   If no valid token exists, the user is redirected to the login page.
 *   If authenticated, renders the child route via <Outlet />.
 */
export function ProtectedRoute() {
  if (!AuthService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
