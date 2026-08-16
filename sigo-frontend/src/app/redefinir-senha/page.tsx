"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthPageLayout } from "@/components/Auth/AuthPageLayout";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { TextInput } from "@/components/Form/TextInput";
import { SigoLoader } from "@/components/Loading/SigoLoader";
import { useAuth } from "@/hooks/useAuth";
import {
  authApiPaths,
  extractApiError,
  extractFieldError,
  validateNewPassword,
} from "@/lib/auth-api";
import { fetchJson } from "@/lib/api";
import { routes } from "@/navigation/routes";

type ResetState =
  | "validating"
  | "ready"
  | "submitting"
  | "invalid"
  | "load-error"
  | "success";

type PasswordErrors = {
  newPassword?: string;
  confirmPassword?: string;
};

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const { baseUrl } = useAuth();
  const token = searchParams.get("token")?.trim() ?? "";
  const [resetState, setResetState] = useState<ResetState>("validating");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setResetState("invalid");
      return;
    }

    const controller = new AbortController();
    setResetState("validating");
    setRequestError(null);

    const validateToken = async () => {
      const result = await fetchJson(baseUrl, authApiPaths.validateResetToken, {
        method: "POST",
        body: { token },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      if (result.ok) {
        setResetState("ready");
        return;
      }
      if (result.status === 0) {
        setResetState("load-error");
        return;
      }
      setResetState("invalid");
    };

    void validateToken();
    return () => controller.abort();
  }, [baseUrl, token, validationAttempt]);

  const validateForm = (): boolean => {
    const nextErrors: PasswordErrors = {};
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) nextErrors.newPassword = passwordError;
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirme a nova senha.";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "A confirmação da nova senha não confere.";
    }
    setPasswordErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestError(null);
    if (!validateForm()) return;

    setResetState("submitting");
    const result = await fetchJson(baseUrl, authApiPaths.resetPassword, {
      method: "POST",
      body: { token, newPassword, confirmPassword },
    });

    if (result.ok) {
      setNewPassword("");
      setConfirmPassword("");
      setResetState("success");
      return;
    }

    const newPasswordError = extractFieldError(result.data, ["newPassword", "NovaSenha"]);
    const confirmationError = extractFieldError(result.data, [
      "confirmPassword",
      "ConfirmarSenha",
    ]);
    if (newPasswordError || confirmationError) {
      setPasswordErrors({
        newPassword: newPasswordError ?? undefined,
        confirmPassword: confirmationError ?? undefined,
      });
      setResetState("ready");
      return;
    }

    if (result.status === 400 || result.status === 404 || result.status === 409) {
      setResetState("invalid");
      return;
    }

    setRequestError(
      extractApiError(result.data, "Não foi possível redefinir a senha. Tente novamente.")
    );
    setResetState("ready");
  };

  const isSubmitting = resetState === "submitting";

  return (
    <AuthPageLayout
      eyebrow="Segurança da conta"
      title="Criar nova senha"
      description="Defina uma nova senha para acessar sua conta no SIGO."
    >
      <div className="grid gap-5 p-6" aria-live="polite">
        {resetState === "validating" ? (
          <div className="flex min-h-48 items-center justify-center" aria-label="Validando link">
            <SigoLoader />
          </div>
        ) : null}

        {resetState === "invalid" ? (
          <>
            <div className="sigo-error px-4 py-4 text-sm font-semibold leading-6" role="alert">
              Este link de redefinição é inválido ou expirou.
            </div>
            <Link className="sigo-button sigo-button-primary w-full" href={routes.forgotPassword}>
              Solicitar novo link
            </Link>
          </>
        ) : null}

        {resetState === "load-error" ? (
          <>
            <div className="sigo-error px-4 py-4 text-sm font-semibold leading-6" role="alert">
              Não foi possível validar o link agora. Verifique sua conexão e tente novamente.
            </div>
            <button
              type="button"
              className="sigo-button sigo-button-primary w-full"
              onClick={() => setValidationAttempt((attempt) => attempt + 1)}
            >
              Tentar novamente
            </button>
          </>
        ) : null}

        {resetState === "ready" || resetState === "submitting" ? (
          <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
            <TextInput
              id="new-password"
              name="newPassword"
              label="Nova senha"
              value={newPassword}
              onChange={(value) => {
                setNewPassword(value);
                setPasswordErrors((current) => ({ ...current, newPassword: undefined }));
              }}
              type="password"
              autoComplete="new-password"
              maxLength={128}
              helperText="Use de 8 a 128 caracteres, com pelo menos uma letra e um número."
              error={passwordErrors.newPassword}
              disabled={isSubmitting}
              showPasswordToggle
              required
            />
            <TextInput
              id="confirm-password"
              name="confirmPassword"
              label="Confirmar nova senha"
              value={confirmPassword}
              onChange={(value) => {
                setConfirmPassword(value);
                setPasswordErrors((current) => ({ ...current, confirmPassword: undefined }));
              }}
              type="password"
              autoComplete="new-password"
              maxLength={128}
              error={passwordErrors.confirmPassword}
              disabled={isSubmitting}
              showPasswordToggle
              required
            />

            {requestError ? (
              <div className="sigo-error px-4 py-3 text-sm font-semibold" role="alert">
                {requestError}
              </div>
            ) : null}

            <button
              type="submit"
              className="sigo-button sigo-button-primary w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
            </button>
          </form>
        ) : null}

        {resetState === "success" ? (
          <div className="sigo-success px-4 py-4 text-sm font-semibold" role="status">
            Senha redefinida com sucesso.
          </div>
        ) : null}

        {resetState !== "validating" ? (
          <Link
            className="text-center text-sm font-bold text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]"
            href={routes.login}
          >
            Voltar para o login
          </Link>
        ) : null}
      </div>
    </AuthPageLayout>
  );
}

function ResetPasswordFallback() {
  return (
    <AuthPageLayout
      eyebrow="Segurança da conta"
      title="Criar nova senha"
      description="Defina uma nova senha para acessar sua conta no SIGO."
    >
      <div className="flex min-h-48 items-center justify-center p-6">
        <SigoLoader />
      </div>
    </AuthPageLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <PublicOnlyRoute>
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordContent />
      </Suspense>
    </PublicOnlyRoute>
  );
}
