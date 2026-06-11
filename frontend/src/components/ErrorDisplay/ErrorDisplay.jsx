/**
 * ErrorDisplay — Reusable error display component.
 */
export function ErrorDisplay({ error, onRetry }) {
  if (!error) return null;

  return (
    <div className="error-display" role="alert">
      <p>{error.message || "An unexpected error occurred"}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
