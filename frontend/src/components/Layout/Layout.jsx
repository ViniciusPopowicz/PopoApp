import { Outlet, Link } from "react-router-dom";

/**
 * Layout — Application shell with navigation and content outlet.
 * Wraps all pages via the route configuration.
 */
export function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <nav>
          <Link to="/">Home</Link>
          <Link to="/users">Users</Link>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
