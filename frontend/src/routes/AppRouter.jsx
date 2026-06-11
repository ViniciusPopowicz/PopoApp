import { createBrowserRouter } from "react-router-dom";
import { Layout, ProtectedRoute } from "../components";
import { HomePage, UserListPage, UserDetailPage, NotFoundPage, LoginPage, DashboardPage } from "../pages";

/**
 * Application route configuration.
 *
 * Pattern:
 *   - All routes are defined in a single configuration object.
 *   - Layout wraps all pages via the root route's element + children.
 *   - New pages are added as objects in the children array.
 *   - The catch-all "*" route renders the 404 page.
 *   - Login is a standalone route (no Layout wrapper).
 *   - Dashboard is wrapped by ProtectedRoute for JWT authentication.
 */
export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
    ],
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "users",
        element: <UserListPage />,
      },
      {
        path: "users/:id",
        element: <UserDetailPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

