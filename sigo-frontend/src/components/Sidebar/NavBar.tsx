"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { routes } from "@/navigation/routes";

export function NavBar() {
  const { token, userName, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-[var(--sigo-blue-deep)] via-[var(--sigo-blue-dark)] to-[var(--sigo-blue)] text-white shadow-[var(--sigo-shadow-md)]">
      <div className="sigo-shell sigo-navbar-shell flex min-h-20 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={token ? routes.dashboard : routes.login}
          className="flex min-w-0 items-center gap-3"
          aria-label="Ir para o dashboard do SIGO"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center">
            <img
              src="/sigo-logo.png"
              alt="Logo SIGO"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="grid min-w-0">
            <span className="truncate text-[0.9375rem] font-bold text-blue-100">
              Sistema de Informatização e Gestão para Oficinas
            </span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {token ? (
            <>
              <span className="text-[0.9375rem] font-bold text-blue-50">
                {`Olá, ${userName || "usuario"}`}
              </span>
              <Link
                href={routes.profile}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm hover:bg-white hover:text-[var(--sigo-blue-deep)]"
                aria-label="Perfil"
                title="Perfil"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Link>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={logout}
                aria-label="Sair"
                title="Sair"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
