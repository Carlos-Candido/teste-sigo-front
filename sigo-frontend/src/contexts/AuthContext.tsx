"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResult } from "@/lib/api";
import { fetchJson } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import type { AuthContextValue, AuthLoginPayload } from "@/models/auth";

const defaultBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://localhost:7241";

export const AuthContext = createContext<AuthContextValue | null>(null);


const sanitizeToken = (value: string): string =>
  value.trim().replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const [, payload] = sanitizeToken(token).split(".");
  if (!payload || typeof window === "undefined") return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getStringClaim = (
  payload: Record<string, unknown> | null,
  names: string[]
): string => {
  if (!payload) return "";

  for (const name of names) {
    const value = payload[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string" && item.trim());
      if (typeof first === "string") return first.trim();
    }
  }

  const fallback = Object.entries(payload).find(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    return (
      typeof value === "string" &&
      value.trim() &&
      !normalizedKey.includes("nameidentifier") &&
      !normalizedKey.endsWith("/nameidentifier") &&
      (normalizedKey === "name" ||
        normalizedKey === "unique_name" ||
        normalizedKey === "given_name" ||
        normalizedKey.endsWith("/name"))
    );
  });

  return typeof fallback?.[1] === "string" ? fallback[1].trim() : "";
};

const getFirstNameFromToken = (token: string): string => {
  const fullName = getFullNameFromToken(token);
  if (!fullName) return "";

  const nameOrEmail = fullName.trim();
  const beforeEmailDomain = nameOrEmail.split("@")[0];
  return beforeEmailDomain.split(/\s+/)[0] ?? "";
};

const getFullNameFromToken = (token: string): string => {
  const payload = decodeJwtPayload(token);
  const fullName =
    getStringClaim(payload, [
      "name",
      "unique_name",
      "given_name",
      "Nome",
      "nome",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    ]) ||
    getStringClaim(payload, [
      "email",
      "Email",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    ]);

  if (!fullName) return "";
  return fullName;
};

const getEmailFromToken = (token: string): string => {
  const payload = decodeJwtPayload(token);
  return getStringClaim(payload, [
    "email",
    "Email",
    "mail",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  ]);
};

const getNumericClaim = (
  payload: Record<string, unknown> | null,
  names: string[]
): number | null => {
  if (!payload) return null;

  for (const name of names) {
    const rawValue = payload[name];
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const getUserIdFromToken = (token: string): number | null => {
  const payload = decodeJwtPayload(token);
  return getNumericClaim(payload, [
    "id",
    "Id",
    "ID",
    "userId",
    "UserId",
    "usuarioId",
    "UsuarioId",
    "clienteId",
    "ClienteId",
    "funcionarioId",
    "FuncionarioId",
    "oficinaId",
    "OficinaId",
    "sub",
    "nameid",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/nameidentifier",
  ]);
};

const getOficinaIdFromToken = (token: string): number | null => {
  const payload = decodeJwtPayload(token);
  return getNumericClaim(payload, [
    "oficina_id",
    "oficinaId",
    "OficinaId",
    "idOficina",
    "IdOficina",
  ]);
};

const getRoleFromToken = (token: string): string => {
  const payload = decodeJwtPayload(token);
  return getStringClaim(payload, [
    "role",
    "Role",
    "roles",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role",
  ]);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedToken = authStorage.get();
    if (storedToken) setToken(storedToken);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (token) {
      authStorage.set(token);
    } else {
      authStorage.clear();
    }
  }, [token, isReady]);

  const setBaseUrl = useCallback((value: string) => {
    if (value !== defaultBaseUrl) {
      setBaseUrlState(defaultBaseUrl);
      return;
    }
    setBaseUrlState(value);
  }, []);

const login = async (payload: AuthLoginPayload): Promise<ApiResult> => {
  const result = await fetchJson(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    body: {
      identifier: payload.identifier.trim(),
      password: payload.password,
    },
  });

  if (result.ok && typeof result.data === "object" && result.data) {
    const record = result.data as {
      accessToken?: string;
      AccessToken?: string;
      token?: string;
      Token?: string;
    };

    const tokenValue =
      record.accessToken ??
      record.AccessToken ??
      record.token ??
      record.Token ??
      "";

    if (tokenValue) {
      setToken(sanitizeToken(tokenValue));
    }
  }

  return result;
};

  const logout = () => {
    setToken("");
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  };
  const userName = useMemo(() => getFirstNameFromToken(token), [token]);
  const fullName = useMemo(() => getFullNameFromToken(token), [token]);
  const userEmail = useMemo(() => getEmailFromToken(token), [token]);
  const userId = useMemo(() => getUserIdFromToken(token), [token]);
  const userRole = useMemo(() => getRoleFromToken(token), [token]);
  const oficinaId = useMemo(() => getOficinaIdFromToken(token), [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      baseUrl,
      setBaseUrl,
      token,
      setToken,
      userName,
      fullName,
      userEmail,
      userId,
      userRole,
      oficinaId,
      login,
      logout,
      isReady,
    }),
    [
      baseUrl,
      token,
      userName,
      fullName,
      userEmail,
      userId,
      userRole,
      oficinaId,
      isReady,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
