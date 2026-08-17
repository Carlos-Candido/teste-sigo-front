export const authApiPaths = {
  forgotPassword: "/api/v1/auth/forgot-password",
  validateResetToken: "/api/v1/auth/reset-password/validate",
  resetPassword: "/api/v1/auth/reset-password",
} as const;

export const passwordRecoveryGenericMessage =
  "Se existir uma conta associada a este e-mail, enviaremos as instruções para redefinição de senha.";

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const validateNewPassword = (password: string): string | null => {
  if (!password) return "Informe a nova senha.";
  if (password.length < 8 || password.length > 128) {
    return "A senha deve ter entre 8 e 128 caracteres.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "A senha deve conter ao menos uma letra e um número.";
  }
  return null;
};

export const extractApiError = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  for (const key of ["detail", "message", "Message", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
};

export const extractFieldError = (
  data: unknown,
  fieldNames: readonly string[]
): string | null => {
  if (!data || typeof data !== "object") return null;
  const errors = (data as Record<string, unknown>).errors;
  if (!errors || typeof errors !== "object") return null;

  const normalizedNames = new Set(fieldNames.map((name) => name.toLowerCase()));
  for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
    if (!normalizedNames.has(field.toLowerCase())) continue;
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const message = value.find((item) => typeof item === "string" && item.trim());
      if (typeof message === "string") return message;
    }
  }

  return null;
};
