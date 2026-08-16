"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthPageLayout } from "@/components/Auth/AuthPageLayout";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { TextInput } from "@/components/Form/TextInput";
import { useAuth } from "@/hooks/useAuth";
import {
  authApiPaths,
  extractApiError,
  isValidEmail,
  passwordRecoveryGenericMessage,
} from "@/lib/auth-api";
import { fetchJson } from "@/lib/api";
import { routes } from "@/navigation/routes";

type RequestState = "idle" | "submitting" | "success" | "error";

export default function ForgotPasswordPage() {
  const { baseUrl } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [requestError, setRequestError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError(null);
    setRequestError(null);

    if (!email.trim()) {
      setEmailError("Informe o e-mail.");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Informe um e-mail válido.");
      return;
    }

    setRequestState("submitting");
    const result = await fetchJson(baseUrl, authApiPaths.forgotPassword, {
      method: "POST",
      body: { email: email.trim().toLowerCase() },
    });

    if (result.ok) {
      setRequestState("success");
      return;
    }

    setRequestState("error");
    setRequestError(
      extractApiError(
        result.data,
        "Não foi possível enviar as instruções agora. Tente novamente."
      )
    );
  };

  const isSubmitting = requestState === "submitting";

  return (
    <PublicOnlyRoute>
      <AuthPageLayout
        eyebrow="Segurança da conta"
        title="Esqueceu sua senha?"
        description="Informe seu e-mail para receber as instruções de redefinição de senha."
      >
        <form className="grid gap-5 p-6" onSubmit={handleSubmit} noValidate>
          {requestState === "success" ? (
            <div
              className="sigo-success px-4 py-4 text-sm font-semibold leading-6"
              role="status"
            >
              {passwordRecoveryGenericMessage}
            </div>
          ) : (
            <>
              <TextInput
                id="recovery-email"
                name="email"
                label="E-mail"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  setEmailError(null);
                  if (requestState === "error") setRequestState("idle");
                }}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="E-mail"
                maxLength={254}
                error={emailError}
                disabled={isSubmitting}
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
                {isSubmitting ? "Enviando..." : "Enviar link de redefinição"}
              </button>
            </>
          )}

          <Link
            className="text-center text-sm font-bold text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]"
            href={routes.login}
          >
            Voltar para o login
          </Link>
        </form>
      </AuthPageLayout>
    </PublicOnlyRoute>
  );
}
