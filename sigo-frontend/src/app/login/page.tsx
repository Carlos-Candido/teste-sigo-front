"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPageLayout } from "@/components/Auth/AuthPageLayout";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { TextInput } from "@/components/Form/TextInput";
import { useAuth } from "@/hooks/useAuth";
import { extractApiError, isValidEmail } from "@/lib/auth-api";
import { formatCpfCnpj, onlyDigits } from "@/lib/fieldMetadata";
import { routes } from "@/navigation/routes";

type FieldErrors = {
  identifier?: string;
  password?: string;
};

type UnifiedLoginResponse = {
  role?: string;
  Role?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const changeIdentifier = (value: string) => {
    const looksLikeDocument = /^[\d.\-/]*$/.test(value);

    setIdentifier(
      looksLikeDocument
        ? formatCpfCnpj(value)
        : value
    );

    setFieldErrors((current) => ({
      ...current,
      identifier: undefined,
    }));
  };

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};
    const value = identifier.trim();

    if (!value) {
      nextErrors.identifier = "Informe seu CPF/CNPJ ou e-mail.";
    } else if (value.includes("@")) {
      if (!isValidEmail(value)) {
        nextErrors.identifier = "Informe um e-mail válido.";
      }
    } else {
      const digits = onlyDigits(value);

      if (![11, 14].includes(digits.length)) {
        nextErrors.identifier = "Informe um CPF ou CNPJ válido.";
      }
    }

    if (!password) {
      nextErrors.password = "Informe a senha.";
    }

    setFieldErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError(null);

    if (!validate()) return;

    setIsLoading(true);

    const result = await login({
      identifier,
      password,
    });

    if (result.ok) {
      const response = result.data as UnifiedLoginResponse | null;

      const role = String(
        response?.role ??
        response?.Role ??
        ""
      ).toLowerCase();

      if (role.includes("cliente")) {
        router.replace(routes.clientHome);
        return;
      }

      if (role.includes("funcionario")) {
        router.replace(routes.employeeHome);
        return;
      }

      // Oficina e Admin
      router.replace(routes.dashboard);
      return;
    }

    setError(
      extractApiError(
        result.data,
        "Não foi possível entrar."
      )
    );

    setIsLoading(false);
  };

  return (
    <PublicOnlyRoute>
      <AuthPageLayout
        eyebrow="Acesso ao sistema"
        title="Entrar"
        description="Informe suas credenciais para entrar no SIGO."
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={handleSubmit}
          noValidate
        >
          <TextInput
            id="login-identifier"
            name="identifier"
            label="CPF/CNPJ ou e-mail"
            value={identifier}
            onChange={changeIdentifier}
            placeholder="CPF/CNPJ ou e-mail"
            type="text"
            autoComplete="username"
            maxLength={254}
            error={fieldErrors.identifier}
            disabled={isLoading}
            required
          />

          <TextInput
            id="login-password"
            name="password"
            label="Senha"
            value={password}
            onChange={(value) => {
              setPassword(value);

              setFieldErrors((current) => ({
                ...current,
                password: undefined,
              }));
            }}
            type="password"
            autoComplete="current-password"
            maxLength={128}
            error={fieldErrors.password}
            disabled={isLoading}
            showPasswordToggle
            required
          />

          {error ? (
            <div
              className="sigo-error px-4 py-3 text-sm font-semibold"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="sigo-button sigo-button-primary w-full"
            disabled={isLoading}
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </button>

          <div className="-mx-6 flex flex-col gap-2 border-t border-[var(--sigo-border)] px-6 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[var(--sigo-muted)]">
              Esqueceu sua senha?
            </span>

            <Link
              className="font-bold text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]"
              href={routes.forgotPassword}
            >
              Redefinir senha
            </Link>
          </div>

          <div className="-mx-6 flex flex-col gap-2 border-t border-[var(--sigo-border)] px-6 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[var(--sigo-muted)]">
              Ainda não tem uma conta?
            </span>

            <Link
              className="font-bold text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]"
              href={routes.register}
            >
              Criar conta
            </Link>
          </div>
        </form>
      </AuthPageLayout>
    </PublicOnlyRoute>
  );
}