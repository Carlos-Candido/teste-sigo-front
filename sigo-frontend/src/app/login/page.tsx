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

type AccountType = "cliente" | "funcionario" | "oficina";

type FieldErrors = {
  identifier?: string;
  password?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("funcionario");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isClient = accountType === "cliente";
  const identifierLabel = isClient ? "CPF ou CNPJ" : "E-mail";

  const changeAccountType = (value: AccountType) => {
    setAccountType(value);
    setIdentifier("");
    setPassword("");
    setFieldErrors({});
    setError(null);
  };

  const changeIdentifier = (value: string) => {
    setIdentifier(isClient ? formatCpfCnpj(value) : value);
    setFieldErrors((current) => ({ ...current, identifier: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!identifier.trim()) {
      nextErrors.identifier = `Informe ${isClient ? "o CPF ou CNPJ" : "o e-mail"}.`;
    } else if (isClient && ![11, 14].includes(onlyDigits(identifier).length)) {
      nextErrors.identifier = "Informe um CPF ou CNPJ válido.";
    } else if (!isClient && !isValidEmail(identifier)) {
      nextErrors.identifier = "Informe um e-mail válido.";
    }
    if (!password) nextErrors.password = "Informe a senha.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setIsLoading(true);
    const result = await login({ identifier, password, accountType });
    if (result.ok) {
      router.replace(
        accountType === "cliente"
          ? routes.clientHome
          : accountType === "funcionario"
            ? routes.employeeHome
            : routes.dashboard
      );
      return;
    }

    setError(extractApiError(result.data, "Não foi possível entrar."));
    setIsLoading(false);
  };

  return (
    <PublicOnlyRoute>
      <AuthPageLayout
        eyebrow="Acesso ao sistema"
        title="Entrar"
        description="Informe suas credenciais para entrar no SIGO."
      >
        <form className="grid gap-5 p-6" onSubmit={handleSubmit} noValidate>
          <label className="grid gap-2 text-sm font-bold text-[var(--sigo-muted)]">
            Tipo de acesso
            <select
              id="account-type"
              name="accountType"
              className="sigo-input bg-white"
              value={accountType}
              onChange={(event) => changeAccountType(event.target.value as AccountType)}
              disabled={isLoading}
            >
              <option value="funcionario">Funcionário</option>
              <option value="oficina">Oficina</option>
              <option value="cliente">Cliente</option>
            </select>
          </label>

          <TextInput
            id="login-identifier"
            name="identifier"
            label={identifierLabel}
            value={identifier}
            onChange={changeIdentifier}
            placeholder={identifierLabel}
            type={isClient ? "text" : "email"}
            inputMode={isClient ? "numeric" : "email"}
            autoComplete={isClient ? "username" : "email"}
            maxLength={isClient ? 18 : 254}
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
              setFieldErrors((current) => ({ ...current, password: undefined }));
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
            <div className="sigo-error px-4 py-3 text-sm font-semibold" role="alert">
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
            <span className="text-[var(--sigo-muted)]">Esqueceu sua senha?</span>
            <Link
              className="font-bold text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]"
              href={routes.forgotPassword}
            >
              Redefinir senha
            </Link>
          </div>
          <div className="-mx-6 flex flex-col gap-2 border-t border-[var(--sigo-border)] px-6 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[var(--sigo-muted)]">Ainda não tem uma conta?</span>
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
