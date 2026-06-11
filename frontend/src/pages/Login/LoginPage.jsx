import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthService } from "../../services";
import { Toast } from "../../components";
import styles from "./LoginPage.module.css";

/**
 * LoginPage — Professional authentication page with username/password form.
 *
 * Features:
 *   - Centered card with modern design
 *   - Password visibility toggle with eye icon
 *   - Loading spinner during authentication
 *   - Toast notification for failed login
 *   - Red border on inputs on error (cleared on typing)
 *   - Redirect to /dashboard on success
 */
export function LoginPage() {
  const navigate = useNavigate();

  //Aqui parece que está setando valores default para algumas variáveis
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "" });

  const handleUsernameChange = useCallback((e) => {
    setUsername(e.target.value);
    setHasError(false);
  }, []);

  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
    setHasError(false);
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (isLoading) return;

      setIsLoading(true);
      setHasError(false);
      setToast({ visible: false, message: "" });

      try {
        await AuthService.login(username, password);
        navigate("/dashboard", { replace: true });
      } catch (error) {
        setHasError(true);
        setToast({
          visible: true,
          message: "Login failed. Please verify your username and password.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [username, password, isLoading, navigate]
  );

  return (
    <div className={styles.page}>
      {/* Background decoration */}
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />
      <div className={styles.bgOrb3} />

      <div className={styles.card}>
        {/* Logo / Brand */}
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.logoSvg}
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className={styles.title}>PopoApp</h1>
          <p className={styles.subtitle}>Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Username Field */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="login-username">
              Username
            </label>
            <div className={`${styles.inputWrapper} ${hasError ? styles.inputError : ""}`}>
              <svg
                className={styles.fieldIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="login-username"
                name="username"
                type="text"
                className={styles.input}
                placeholder="Enter your username"
                value={username}
                onChange={handleUsernameChange}
                autoComplete="username"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="login-password">
              Password
            </label>
            <div className={`${styles.inputWrapper} ${hasError ? styles.inputError : ""}`}>
              <svg
                className={styles.fieldIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder="Enter your password"
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  /* Eye-off icon */
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.eyeIcon}
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* Eye icon */
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.eyeIcon}
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading || !username.trim() || !password.trim()}
            id="login-submit"
          >
            {isLoading ? (
              <span className={styles.buttonContent}>
                <span className={styles.spinner} />
                <span>Signing in...</span>
              </span>
            ) : (
              <span className={styles.buttonContent}>Enter</span>
            )}
          </button>
        </form>
      </div>

      {/* Toast notification */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type="error"
        onClose={() => setToast({ visible: false, message: "" })}
      />
    </div>
  );
}
