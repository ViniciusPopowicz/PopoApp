/**
 * Input — Base reusable input component with label and error display.
 */
export function Input({ label, name, type = "text", value, onChange, error, placeholder, ...rest }) {
  return (
    <div className="input-group">
      {label && <label htmlFor={name}>{label}</label>}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={error ? "input input-error" : "input"}
        {...rest}
      />
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
}
