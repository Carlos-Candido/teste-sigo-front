"use client";

import Link from "next/link";
import { useState } from "react";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { TextInput } from "@/components/Form/TextInput";
import { NavBar } from "@/components/Sidebar/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import { routes } from "@/navigation/routes";

type AccountType = "cliente" | "funcionario" | "oficina";

const loginPaths: Record<Exclude<AccountType, "funcionario">, string> = {
  cliente: "/api/v1/clientes/login",
  oficina: "/api/v1/oficinas/login",
};

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  for (const key of ["detail", "message", "Message", "title"]) {
    if (typeof record[key] === "string" && record[key]) return record[key];
  }
  return fallback;
};

const findToken = (value: unknown): string => {
  if (typeof value === "string") return value.replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["accessToken", "AccessToken", "token", "Token", "data", "Data"]) {
    const token = findToken(record[key]);
    if (token) return token;
  }
  return "";
};

const getUserId = (token: string): number | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as Record<string, unknown>;
    for (const key of ["id", "Id", "userId", "UserId", "sub", "nameid", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]) {
      const id = Number(decoded[key]);
      if (Number.isFinite(id) && id > 0) return id;
    }
  } catch {
    return null;
  }
  return null;
};

export default function RedefinirSenhaPage() {
  const { baseUrl } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>("cliente");
  const [identifier, setIdentifier] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const identifierLabel = accountType === "cliente" ? "CPF ou CNPJ" : "E-mail";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!identifier.trim() || !currentPassword) {
      setError("Informe sua identificação e a senha atual.");
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("A nova senha deve ter ao menos 8 caracteres, uma letra e um número.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("A confirmação da nova senha não confere.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A nova senha deve ser diferente da senha atual.");
      return;
    }
    if (accountType === "funcionario") return;

    setIsLoading(true);
    const isClient = accountType === "cliente";
    const loginResult = await fetchJson(baseUrl, loginPaths[accountType], {
      method: "POST",
      body: isClient
        ? { cpf: identifier.replace(/\D/g, ""), senha: currentPassword }
        : { email: identifier.trim().toLowerCase(), password: currentPassword },
    });

    if (!loginResult.ok) {
      setError(getErrorMessage(loginResult.data, "Não foi possível confirmar a senha atual."));
      setIsLoading(false);
      return;
    }

    const token = findToken(loginResult.data);
    if (!token) {
      setError("A autenticação foi concluída, mas a API não retornou um token válido.");
      setIsLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    let updateResult;
    if (isClient) {
      updateResult = await fetchJson(baseUrl, "/api/v1/clientes/me/senha", {
        method: "PUT",
        headers,
        body: { senhaAtual: currentPassword, novaSenha: newPassword },
      });
    } else {
      const officeId = getUserId(token);
      if (!officeId) {
        setError("Não foi possível identificar a oficina autenticada.");
        setIsLoading(false);
        return;
      }
      const profileResult = await fetchJson(baseUrl, `/api/v1/oficinas/${officeId}`, {
        method: "GET",
        headers,
      });
      if (!profileResult.ok || !profileResult.data || typeof profileResult.data !== "object") {
        setError(getErrorMessage(profileResult.data, "Não foi possível carregar os dados da oficina."));
        setIsLoading(false);
        return;
      }
      updateResult = await fetchJson(baseUrl, `/api/v1/oficinas/${officeId}`, {
        method: "PUT",
        headers,
        body: { ...(profileResult.data as Record<string, unknown>), Senha: newPassword },
      });
    }

    if (!updateResult.ok) {
      setError(getErrorMessage(updateResult.data, "Não foi possível redefinir a senha."));
      setIsLoading(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setSuccess(true);
    setIsLoading(false);
  };

  return (
    <PublicOnlyRoute>
      <div className="sigo-page">
        <NavBar />
        <main className="sigo-shell flex min-h-[calc(100vh-5rem)] items-center justify-center py-8 lg:py-12">
          <section className="sigo-card w-full max-w-xl overflow-hidden bg-white">
            <header className="bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] p-7 text-white">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">Segurança da conta</p>
              <h1 className="mt-2 text-3xl font-black text-white">Redefinir senha</h1>
              <p className="mt-3 text-sm leading-6 text-blue-50">Confirme sua identidade para cadastrar uma nova senha com segurança.</p>
            </header>

            <form className="grid gap-5 p-6" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-bold text-[var(--sigo-muted)]">
                Tipo de acesso
                <select className="sigo-input bg-white" value={accountType} onChange={(event) => { setAccountType(event.target.value as AccountType); setError(null); setSuccess(false); }}>
                  <option value="cliente">Cliente</option>
                  <option value="oficina">Oficina</option>
                  <option value="funcionario">Funcionário</option>
                </select>
              </label>

              {accountType === "funcionario" ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
                  Por segurança, a senha do funcionário é redefinida pela oficina responsável. Solicite a alteração ao administrador da sua oficina e depois volte para entrar.
                </div>
              ) : (
                <>
                  <TextInput label={identifierLabel} value={identifier} onChange={setIdentifier} placeholder={identifierLabel} />
                  <TextInput label="Senha atual" value={currentPassword} onChange={setCurrentPassword} type="password" />
                  <TextInput label="Nova senha" value={newPassword} onChange={setNewPassword} type="password" />
                  <TextInput label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} type="password" />
                  {error ? <div className="sigo-error px-4 py-3 text-sm font-semibold">{error}</div> : null}
                  {success ? <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Senha redefinida. Você já pode entrar com a nova senha.</div> : null}
                  <button type="submit" className="sigo-button sigo-button-primary w-full" disabled={isLoading}>
                    {isLoading ? "Redefinindo..." : "Redefinir senha"}
                  </button>
                </>
              )}

              <Link className="text-center text-sm font-bold text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]" href={routes.login}>
                Voltar para o login
              </Link>
            </form>
          </section>
        </main>
      </div>
    </PublicOnlyRoute>
  );
}
