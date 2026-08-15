"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole, type RoleKey } from "@/lib/accessControl";
import { routes } from "@/navigation/routes";
import { SigoLoader } from "@/components/Loading/SigoLoader";

function RouteLoading() {
  return (
    <div className="sigo-page flex min-h-screen items-center justify-center px-4">
      <SigoLoader />
    </div>
  );
}

const getRoleHome = (role: RoleKey) =>
  role === "cliente" ? routes.clientHome : routes.dashboard;

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: Exclude<RoleKey, "unknown">[];
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const { token, userRole, isReady, logout } = useAuth();
  const role = normalizeRole(userRole);
  const isKnownRole = role !== "unknown";
  const isAllowed = !allowedRoles || (isKnownRole && allowedRoles.includes(role));

  useEffect(() => {
    if (!isReady) return;

    if (!token || !isKnownRole) {
      if (token && !isKnownRole) logout();
      else router.replace(routes.login);
      return;
    }

    if (!isAllowed) router.replace(getRoleHome(role));
  }, [isAllowed, isKnownRole, isReady, logout, role, router, token]);

  if (!isReady || !token || !isKnownRole || !isAllowed) return <RouteLoading />;

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, userRole, isReady } = useAuth();
  const role = normalizeRole(userRole);

  useEffect(() => {
    if (!isReady) return;
    if (token) router.replace(getRoleHome(role));
  }, [isReady, role, router, token]);

  if (!isReady || token) return <RouteLoading />;

  return <>{children}</>;
}