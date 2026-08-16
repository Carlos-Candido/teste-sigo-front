import type { ApiResult } from "@/lib/api";

export type AuthLoginPayload = {
  identifier: string;
  password: string;
  accountType: "cliente" | "funcionario" | "oficina";
};

export type AuthContextValue = {
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  token: string;
  setToken: (value: string) => void;
  userName: string;
  fullName: string;
  userEmail: string;
  userId: number | null;
  userRole: string;
  oficinaId: number | null;
  login: (payload: AuthLoginPayload) => Promise<ApiResult>;
  logout: () => void;
  isReady: boolean;
};
