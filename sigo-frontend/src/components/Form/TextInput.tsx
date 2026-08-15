type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  max?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search" | "none";
};

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  helperText,
  error,
  className = "",
  inputClassName = "",
  disabled = false,
  max,
  maxLength,
  inputMode,
}: TextInputProps) {
  return (
    <label className={`sigo-label ${className}`.trim()}>
      <span>{label}</span>
      <input
        className={`sigo-input ${error ? "border-[var(--sigo-danger)]" : ""} ${inputClassName}`.trim()}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        max={max}
        maxLength={maxLength}
        inputMode={inputMode}
      />
      {error ? (
        <span className="text-xs font-semibold text-[var(--sigo-danger)]">
          {error}
        </span>
      ) : helperText ? (
        <span className="text-xs font-medium text-[var(--sigo-soft)]">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
