export interface RequestSession {
  tenantId: string;
  userId: string;
  kind?: "preview" | "verified";
}

export interface RequestOptions {
  session?: RequestSession;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  retriedAfterRefresh?: boolean;
}

export class ApiRequestError extends Error {
  readonly code?: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.retryable = [408, 425, 429, 500, 502, 503, 504].includes(status);
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const fallbackMessage = (status: number) => {
  if (status === 401) return "Your session is no longer valid. Sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested record could not be found.";
  if (status === 409) return "The record changed or conflicts with another action. Refresh and try again.";
  if (status >= 500) return "The Nischit service is temporarily unavailable. Try again shortly.";
  return `Request failed (${status})`;
};

export const isAbortError = (error: unknown) =>
  error instanceof DOMException ? error.name === "AbortError" : error instanceof Error && error.name === "AbortError";

export async function request<T>(apiBase: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: {
      ...(options.session && options.session.kind !== "verified" ? { "x-tenant-id": options.session.tenantId, "x-user-id": options.session.userId } : {}),
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  let payload: unknown;
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok && response.status === 401 && !options.retriedAfterRefresh && typeof window !== "undefined" && !path.startsWith("/auth/")) {
    const refresh = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
    if (refresh.ok) return request<T>(apiBase, path, { ...options, retriedAfterRefresh: true });
  }

  if (!response.ok) {
    const record = asRecord(payload);
    const message = typeof record.message === "string" && record.message.trim()
      ? record.message
      : fallbackMessage(response.status);
    const code = typeof record.error === "string" ? record.error : undefined;
    throw new ApiRequestError(message, response.status, code);
  }

  if (payload === undefined && raw.trim()) {
    throw new ApiRequestError("The service returned an unreadable response.", response.status);
  }
  return payload as T;
}
