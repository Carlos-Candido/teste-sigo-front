"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { routes } from "@/navigation/routes";
import { NavBar } from "@/components/Sidebar/NavBar";
import { TextInput } from "@/components/Form/TextInput";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";

const extractLoginError = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as {
    message?: string;
    Message?: string;
    detail?: string;
    title?: string;
  };
  return record.detail ?? record.message ?? record.Message ?? record.title ?? null;
};

export default function LoginPage() {
  const router = useRouter();
  const { login, userRole } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"cliente" | "funcionario" | "oficina">("funcionario");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await login({ email: identifier, password, accountType });
    if (result.ok) {
      router.replace(
        userRole.toLowerCase() === "cliente" ? routes.clientHome : routes.dashboard
      );
    } else {
      setError(extractLoginError(result.data) ?? "Não foi possível entrar.");
    }

    setIsLoading(false);
  };

  return (
    <PublicOnlyRoute>
      <div className="sigo-page">
      <NavBar />
      <main className="sigo-shell flex min-h-[calc(100vh-5rem)] items-center justify-center py-8 lg:py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl lg:rounded-r-none border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-lg)] lg:grid-cols-[1.2fr_1fr] lg:divide-x lg:divide-[var(--sigo-border)]">
          <section className="hidden flex-col justify-between bg-[linear-gradient(to_bottom_right,rgba(8,47,99,0.95),rgba(7,95,189,0.85)),url('https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&q=80')] bg-cover bg-center p-10 text-white lg:flex">
            <div className="max-w-xl">
              <div className="mb-6 flex h-32 w-32 items-center justify-center">
                <img
                  src="/sigo-logo.png"
                  alt="Logo SIGO"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="sigo-public-hero-title mt-4 text-lg font-bold text-white">
                Oficina, clientes e serviços em um só painel
              </p>
              <p className="mt-4 max-w-lg text-base leading-7 text-blue-50">
                Acesse o ambiente administrativo para acompanhar cadastros,
                pedidos, veículos, peças e serviços com clareza operacional.
              </p>
            </div>

           
          </section>

          <section className="flex flex-col bg-white">
            <div className="border-b border-[var(--sigo-border)] px-8 py-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <span className="flex h-20 w-20 items-center justify-center">
                <img
                  src="/sigo-logo.png"
                  alt="Logo SIGO"
                  className="h-full w-full object-contain"
                />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                  Sistema de gestão de oficinas
                </p>
              </div>
            </div>

            <p className="text-sm font-bold text-[var(--sigo-blue)]">
              Acesso ao sistema
            </p>
            <h2 className="mt-2 text-3xl font-black text-[var(--sigo-text)]">
              Entrar
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--sigo-muted)]">
              Informe suas credenciais para entrar no SIGO.
            </p>
          </div>

          <form className="grid gap-5 p-6" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-bold text-[var(--sigo-muted)]">
              Tipo de acesso
              <select className="sigo-input bg-white" value={accountType} onChange={(event) => setAccountType(event.target.value as typeof accountType)}>
                <option value="funcionario">Funcionário</option>
                <option value="oficina">Oficina</option>
                <option value="cliente">Cliente</option>
              </select>
            </label>
            <TextInput
              label="CPF, CNPJ ou E-mail"
              value={identifier}
              onChange={setIdentifier}
              placeholder="CPF, CNPJ ou E-mail"
            />
            <TextInput
              label="Senha"
              value={password}
              onChange={setPassword}
              type="password"
            />

            {error ? (
              <div className="sigo-error px-4 py-3 text-sm font-semibold">
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
                Ainda não tem conta?
              </span>
              <Link
                className="font-bold text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]"
                href={routes.register}
              >
                Criar Conta
              </Link>
            </div>

            </form>
          </section>
        </div>
      </main>
      </div>
    </PublicOnlyRoute>
  );
}
