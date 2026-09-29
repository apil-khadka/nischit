import { request as requestApi } from "../api-client";
import type { RoleSession } from "./shared";

export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

export function request<T>(
  path: string,
  session?: RoleSession,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
  signal?: AbortSignal,
) {
  return requestApi<T>(apiBase, path, { session, body, idempotencyKey, signal });
}
