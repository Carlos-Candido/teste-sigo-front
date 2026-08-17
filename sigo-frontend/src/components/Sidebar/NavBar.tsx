"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/accessControl";
import { routes } from "@/navigation/routes";
import { useTheme } from "@/contexts/ThemeContext";
import { profileTypeInfo } from "@/components/Profile/ProfileTypeIcon";

export function NavBar() {
  const { token, userName, fullName, userRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const normalizedRole = normalizeRole(userRole);
  const authenticatedName =
    fullName ||
    userName ||
    (normalizedRole === "unknown" ? "usuário" : profileTypeInfo[normalizedRole].label);
  const handleLogout = () => {
    logout();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-[var(--sigo-blue-deep)] via-[var(--sigo-blue-dark)] to-[var(--sigo-blue)] text-white shadow-[var(--sigo-shadow-md)]">
      <div className="sigo-shell sigo-navbar-shell flex min-h-20 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={token ? (normalizedRole === "cliente" ? routes.clientHome : routes.dashboard) : routes.login}
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
            <span className="sigo-navbar-title truncate text-[0.9375rem] font-bold text-blue-100">
              Sistema de Informatização e Gestão para Oficinas
            </span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {token ? (
            <>
              <span className="sigo-navbar-greeting text-[0.9375rem] font-bold text-blue-50">
                {`Olá, ${authenticatedName}`}
              </span>
              <Link
                href={routes.profile}
                className="sigo-navbar-profile inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm hover:bg-white hover:text-[var(--sigo-blue-deep)]"
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
              <div className="flex items-center gap-2" role="group" aria-label="Selecionar tema">
                <img src="/sun.png" alt="Tema claro" className="sigo-theme-icon h-5 w-5 object-contain" />
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === "dark"}
                  aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
                  title={theme === "dark" ? "Tema escuro" : "Tema claro"}
                  className={`relative h-7 w-13 rounded-full border border-white/30 p-0.5 transition-colors ${
                    theme === "dark" ? "bg-slate-950/70" : "bg-white/25"
                  }`}
                  onClick={toggleTheme}
                >
                  <span
                    className={`sigo-theme-toggle-thumb block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                      theme === "dark" ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
                <img src="/moon.png" alt="Tema escuro" className="sigo-theme-icon h-5 w-5 object-contain" />
              </div>
              <button
                type="button"
                className="sigo-logout-button inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={handleLogout}
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
          ) : (
            <div className="flex items-center gap-2" role="group" aria-label="Selecionar tema">
              <img src="/sun.png" alt="Tema claro" className="sigo-theme-icon h-5 w-5 object-contain" />
              <button
                type="button"
                role="switch"
                aria-checked={theme === "dark"}
                aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
                title={theme === "dark" ? "Tema escuro" : "Tema claro"}
                className={`relative h-7 w-13 rounded-full border border-white/30 p-0.5 transition-colors ${
                  theme === "dark" ? "bg-slate-950/70" : "bg-white/25"
                }`}
                onClick={toggleTheme}
              >
                <span
                  className={`sigo-theme-toggle-thumb block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                    theme === "dark" ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <img src="/moon.png" alt="Tema escuro" className="sigo-theme-icon h-5 w-5 object-contain" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
