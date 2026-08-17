"use client";

import { useId, useState } from "react";

type TextInputProps = {
  id?: string;
  name?: string;
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
  autoComplete?: string;
  required?: boolean;
  showPasswordToggle?: boolean;
};

export function TextInput({
  id,
  name,
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
  autoComplete,
  required = false,
  showPasswordToggle = false,
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const canTogglePassword = showPasswordToggle && type === "password";
  const resolvedType = canTogglePassword && isPasswordVisible ? "text" : type;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = !error && helperText ? `${inputId}-helper` : undefined;

  return (
    <div className={`sigo-label ${className}`.trim()}>
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          className={`sigo-input ${canTogglePassword ? "pr-24" : ""} ${error ? "border-[var(--sigo-danger)]" : ""} ${inputClassName}`.trim()}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={resolvedType}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          max={max}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required={required}
          aria-describedby={errorId ?? helperId}
        />
        {canTogglePassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 min-w-20 rounded-r-lg px-3 text-xs font-black text-[var(--sigo-blue)] hover:bg-[var(--sigo-surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--sigo-blue)]"
            onClick={() => setIsPasswordVisible((current) => !current)}
            aria-pressed={isPasswordVisible}
            aria-label={isPasswordVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            disabled={disabled}
          >
            {isPasswordVisible ? "Ocultar" : "Mostrar"}
          </button>
        ) : null}
      </div>
      {error ? (
        <span id={errorId} className="text-xs font-semibold text-[var(--sigo-danger)]">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="text-xs font-medium text-[var(--sigo-muted)]">
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
