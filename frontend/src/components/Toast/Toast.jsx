import { useState, useEffect, useCallback } from "react";
import styles from "./Toast.module.css";

/**
 * Toast — Notification component positioned at the top-right corner.
 *
 * Props:
 *   - message: The text to display.
 *   - type: Visual variant ("error" | "success" | "info"). Default: "info".
 *   - duration: Auto-dismiss time in ms. Default: 5000.
 *   - onClose: Callback when the toast is dismissed.
 *   - visible: Whether to show the toast.
 */
export function Toast({ message, type = "info", duration = 5000, onClose, visible }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      onClose?.();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, handleClose]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.toast} ${styles[type]} ${isExiting ? styles.exit : styles.enter}`}
      role="alert"
      aria-live="assertive"
    >
      <span className={styles.message}>{message}</span>
      <button
        className={styles.closeButton}
        onClick={handleClose}
        aria-label="Close notification"
        type="button"
      >
        ×
      </button>
    </div>
  );
}
