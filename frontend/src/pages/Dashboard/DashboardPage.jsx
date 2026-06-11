import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthService } from "../../services";
import styles from "./DashboardPage.module.css";

/**
 * DashboardPage — Protected page that proves authentication succeeded.
 *
 * Displays "Hello World" and provides a logout button.
 * Only accessible to authenticated users (guarded by ProtectedRoute).
 */
export function DashboardPage() {
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    AuthService.logout();
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.successIcon}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.checkSvg}
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className={styles.title}>Hello World</h1>
        <p className={styles.subtitle}>
          Authentication successful. You are now signed in.
        </p>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          id="dashboard-logout"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
