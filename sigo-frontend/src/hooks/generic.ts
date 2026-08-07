import { authStorage } from "@/lib/auth-storage";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://localhost:7241";
const API_PREFIX = "/api/v1";

export interface ResponseEnvelope<T> {
  code?: string | number;
  message?: string;
  data?: T | null;
}

export interface PaginatedResult<T> {
  items: T[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ListQuery {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

const DEFAULT_LIST_QUERY: Required<Pick<ListQuery, "page" | "size">> = {
  page: 1,
  size: 100,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isResponseEnvelope = <T,>(value: unknown): value is ResponseEnvelope<T> =>
  isRecord(value) && "data" in value;

const isPaginatedResult = <T,>(value: unknown): value is PaginatedResult<T> =>
  isRecord(value) && Array.isArray(value.items);

const toQueryString = (
  query: ListQuery | undefined,
  defaults: Required<Pick<ListQuery, "page" | "size">> = DEFAULT_LIST_QUERY
): string => {
  const params = new URLSearchParams();
  const mergedQuery = { ...defaults, ...query };

  Object.entries(mergedQuery).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

const parseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (isRecord(payload)) {
    const message = payload.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }

  if (typeof payload === "string" && payload.trim()) return payload.trim();

  return fallback;
};

export class GenericService<T> {
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  protected getUrlEndpoint(): string {
    const normalizedEndpoint = this.endpoint.replace(/^\/?api\/v1\//, "").replace(/^\/?api\//, "");
    return `${BASE_URL}${API_PREFIX}/${normalizedEndpoint}`;
  }

  protected createHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init);
    const token = authStorage.get();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
  }

  protected async handleResponse<R = unknown>(response: Response): Promise<R> {
    if (response.status === 204) return undefined as R;

    const payload = await parseBody(response);

    if (!response.ok) {
      const message = extractErrorMessage(payload, `HTTP ${response.status}`);
      throw new Error(message);
    }

    return payload as R;
  }

  protected unwrapItem<R>(payload: unknown): R {
    if (isResponseEnvelope<R>(payload)) return payload.data as R;
    return payload as R;
  }

  protected unwrapCollection<R>(payload: unknown): R[] {
    const data = isResponseEnvelope<unknown>(payload) ? payload.data : payload;

    if (Array.isArray(data)) return data as R[];
    if (isPaginatedResult<R>(data)) return data.items;
    if (isRecord(data)) {
      const items = data.items;
      if (Array.isArray(items)) return items as R[];
    }
    return [];
  }

  protected normalizePaginatedResult<R>(
    payload: unknown,
    query?: ListQuery
  ): PaginatedResult<R> {
    const data = isResponseEnvelope<unknown>(payload) ? payload.data : payload;
    const page = query?.page ?? DEFAULT_LIST_QUERY.page;
    const size = query?.size ?? DEFAULT_LIST_QUERY.size;

    if (isPaginatedResult<R>(data)) return data;
    if (isRecord(data) && Array.isArray(data.items)) {
      return {
        items: data.items as R[],
        totalRecords: typeof data.totalItems === "number" ? data.totalItems : data.items.length,
        totalPages: typeof data.totalPages === "number" ? data.totalPages : 0,
        currentPage: typeof data.page === "number" ? data.page : 1,
        pageSize: typeof data.pageSize === "number" ? data.pageSize : data.items.length,
      };
    }

    const items = Array.isArray(data) ? (data as R[]) : [];
    const totalRecords = items.length;
    const totalPages = totalRecords === 0 ? 0 : Math.ceil(totalRecords / size);

    return {
      items,
      totalRecords,
      totalPages,
      currentPage: totalPages === 0 ? 1 : Math.min(page, totalPages),
      pageSize: size,
    };
  }

  async getAll(query?: ListQuery): Promise<T[]> {
    const response = await fetch(
      `${this.getUrlEndpoint()}${toQueryString(query)}`,
      { headers: this.createHeaders() }
    );

    const payload = await this.handleResponse(response);
    return this.unwrapCollection<T>(payload);
  }

  async getPage(query?: ListQuery): Promise<PaginatedResult<T>> {
    const response = await fetch(
      `${this.getUrlEndpoint()}${toQueryString(query)}`,
      { headers: this.createHeaders() }
    );

    const payload = await this.handleResponse(response);
    return this.normalizePaginatedResult<T>(payload, query);
  }

  async getById(id: number): Promise<T> {
    const response = await fetch(`${this.getUrlEndpoint()}/${id}`, {
      headers: this.createHeaders(),
    });

    const payload = await this.handleResponse(response);
    return this.unwrapItem<T>(payload);
  }

  async create(data: unknown): Promise<T> {
    const response = await fetch(this.getUrlEndpoint(), {
      method: "POST",
      headers: this.createHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(data),
    });

    const payload = await this.handleResponse(response);
    return this.unwrapItem<T>(payload);
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    const response = await fetch(`${this.getUrlEndpoint()}/${id}`, {
      method: "PUT",
      headers: this.createHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(data),
    });

    const payload = await this.handleResponse(response);
    return this.unwrapItem<T>(payload);
  }

  async delete(id: number): Promise<void> {
    const response = await fetch(`${this.getUrlEndpoint()}/${id}`, {
      method: "DELETE",
      headers: this.createHeaders(),
    });

    await this.handleResponse(response);
  }

  async patch(id: number, data: Partial<T>): Promise<T> {
    const response = await fetch(`${this.getUrlEndpoint()}/${id}`, {
      method: "PATCH",
      headers: this.createHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(data),
    });

    const payload = await this.handleResponse(response);
    return this.unwrapItem<T>(payload);
  }
}
