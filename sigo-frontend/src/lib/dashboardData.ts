import { fetchJson } from "@/lib/api";

export type DashboardRecord = Record<string, unknown>;

export const isDashboardRecord = (value: unknown): value is DashboardRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeKey = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const getDashboardValue = (
  item: DashboardRecord | undefined,
  ...keys: string[]
): unknown => {
  if (!item) return undefined;
  for (const key of keys) {
    const normalized = normalizeKey(key);
    const match = Object.keys(item).find(
      (candidate) => normalizeKey(candidate) === normalized
    );
    if (match) return item[match];
  }
  return undefined;
};

export const extractDashboardList = (data: unknown): DashboardRecord[] => {
  if (Array.isArray(data)) return data.filter(isDashboardRecord);
  if (!isDashboardRecord(data)) return [];
  const nested = data.data ?? data.Data ?? data.items ?? data.Items ?? data.result;
  if (Array.isArray(nested)) return nested.filter(isDashboardRecord);
  if (isDashboardRecord(nested)) {
    const items = nested.items ?? nested.Items ?? nested.data ?? nested.Data;
    if (Array.isArray(items)) return items.filter(isDashboardRecord);
  }
  return [];
};

const getPaginationValue = (data: unknown, ...keys: string[]): unknown => {
  if (!isDashboardRecord(data)) return undefined;
  const direct = getDashboardValue(data, ...keys);
  if (direct !== undefined) return direct;
  const nested = data.data ?? data.Data ?? data.result;
  return isDashboardRecord(nested)
    ? getDashboardValue(nested, ...keys)
    : undefined;
};

export const toDashboardNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const sanitized = text.replace(/[^0-9,.-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const fetchAllDashboardRecords = async (
  baseUrl: string,
  listPath: string,
  headers?: HeadersInit
): Promise<DashboardRecord[]> => {
  const separator = listPath.includes("?") ? "&" : "?";
  const pagePath = (page: number) =>
    `${listPath}${separator}page=${page}&pageSize=100`;
  const first = await fetchJson(baseUrl, pagePath(1), { method: "GET", headers });
  if (!first.ok) return [];

  const declaredPages = Math.max(
    1,
    Math.trunc(toDashboardNumber(getPaginationValue(first.data, "totalPages")))
  );
  const remaining = declaredPages > 1
    ? await Promise.all(
        Array.from({ length: declaredPages - 1 }, (_, index) =>
          fetchJson(baseUrl, pagePath(index + 2), { method: "GET", headers })
        )
      )
    : [];

  const records = [
    ...extractDashboardList(first.data),
    ...remaining.flatMap((result) =>
      result.ok ? extractDashboardList(result.data) : []
    ),
  ];
  const seen = new Set<string>();
  return records.filter((item, index) => {
    const id = getDashboardValue(item, "Id", "id");
    const key = id === undefined || id === null || id === ""
      ? `index:${index}`
      : String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
