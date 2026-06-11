/**
 * Loading — Reusable loading indicator component.
 */
export function Loading({ message = "Loading..." }) {
  return (
    <div className="loading" role="status" aria-label={message}>
      <span>{message}</span>
    </div>
  );
}
