"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/accessControl";
import { routes } from "@/navigation/routes";

function RouteLoading() {
  return (
    <div className="sigo-page flex min-h-screen items-center justify-center px-4 text-sm font-semibold text-[var(--sigo-muted)]">
      Carregando...
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!token) router.replace(routes.login);
  }, [isReady, router, token]);

  if (!isReady || !token) return <RouteLoading />;

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, userRole, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (token) {
      router.replace(
        normalizeRole(userRole) === "cliente" ? routes.clientHome : routes.dashboard
      );
    }
  }, [isReady, router, token, userRole]);

  if (!isReady || token) return <RouteLoading />;

  return <>{children}</>;
}
