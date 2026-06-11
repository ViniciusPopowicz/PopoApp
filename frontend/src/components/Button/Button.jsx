/**
 * Button — Base reusable button component.
 *
 * Pattern:
 *   - Components receive data and callbacks via props.
 *   - Components NEVER call services directly.
 *   - Components are purely presentational or behavioral — no business logic.
 */
export function Button({ children, type = "button", variant = "primary", disabled = false, onClick, ...rest }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
