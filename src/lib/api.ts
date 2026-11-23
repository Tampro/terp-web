"use client"

import { useLanguageStore } from "@/lib/i18n"

/** Envelope returned by every ERP endpoint (ApiMessageDto). */
export interface ApiMessage<T> {
  result?: boolean
  code?: string
  data?: T
  message?: string
  traceId?: string
  errors?: { field?: string; message?: string }[]
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public errors?: ApiMessage<unknown>["errors"]
  ) {
    super(message)
  }
}

/** List page (ResponseListDto): `page` is zero-based. */
export interface IPage<T> {
  content?: T[]
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
  last?: boolean
}

/** Appends defined, non-empty params as a query string. */
export function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

/**
 * "Login As Company" (super admin): the session key from POST /iam/companies/{id}/impersonation is sent as
 * X-Act-As-Company on every request until ended. Kept in sessionStorage (this tab only, ends with it).
 */
export interface ActAsSession {
  sessionKey: string
  companyId?: string
  companyName?: string
  expiresAt?: string
}
const ACT_AS_KEY = "erp.actAs"
export const actAsStore = {
  get(): ActAsSession | null {
    if (typeof window === "undefined") return null
    try {
      const s = JSON.parse(sessionStorage.getItem(ACT_AS_KEY) ?? "null") as ActAsSession | null
      if (s?.expiresAt && Date.parse(s.expiresAt) < Date.now()) {
        sessionStorage.removeItem(ACT_AS_KEY)
        return null
      }
      return s?.sessionKey ? s : null
    } catch {
      return null
    }
  },
  set(s: ActAsSession) {
    sessionStorage.setItem(ACT_AS_KEY, JSON.stringify(s))
  },
  clear() {
    sessionStorage.removeItem(ACT_AS_KEY)
  },
}

export interface TokenPair {
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  refreshExpiresIn?: number
}

const TOKEN_KEY = "erp.token"
const REFRESH_KEY = "erp.refreshToken"

/** "Remember me" on → localStorage (survives closing the browser); off → sessionStorage (this tab only). */
const read = (key: string) =>
  typeof window === "undefined" ? null : (localStorage.getItem(key) ?? sessionStorage.getItem(key))

export const tokenStore = {
  get access() {
    return read(TOKEN_KEY)
  },
  get refresh() {
    return read(REFRESH_KEY)
  },
  set(t?: TokenPair, remember?: boolean) {
    // Without an explicit choice (token refresh), keep using the storage that already holds the tokens.
    const persistent = remember ?? localStorage.getItem(REFRESH_KEY) !== null
    const store = persistent ? localStorage : sessionStorage
    if (remember !== undefined) tokenStore.clear()
    if (t?.accessToken) store.setItem(TOKEN_KEY, t.accessToken)
    if (t?.refreshToken) store.setItem(REFRESH_KEY, t.refreshToken)
  },
  clear() {
    sessionStorage.removeItem(ACT_AS_KEY)
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(TOKEN_KEY)
      s.removeItem(REFRESH_KEY)
    }
  },
}

let refreshing: Promise<boolean> | null = null

/** POST /auth/refresh-token once for all concurrent 401s; the refresh token rotates. */
function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.refresh
  if (!refreshToken) return Promise.resolve(false)
  refreshing ??= fetch("/api/v1/auth/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      const body = (await res.json()) as ApiMessage<TokenPair>
      tokenStore.set(body.data)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** as: "blob" returns the raw body (PDF downloads); errors still come as the JSON envelope → ApiError. */
type RequestOptions = { method?: string; body?: unknown; auth?: boolean; as?: "json" | "blob"; headers?: Record<string, string> }

/** Calls the backend, unwraps the envelope, refreshes once on 401, throws ApiError otherwise. */
export async function request<T>(
  path: string,
  { method = "GET", body, auth = true, as = "json", headers: extra }: RequestOptions = {},
  retry = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...extra,
    "Accept-Language": useLanguageStore.getState().language,
  }
  const isForm = typeof FormData !== "undefined" && body instanceof FormData
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json"
  const token = auth ? tokenStore.access : null
  if (token) headers.Authorization = `Bearer ${token}`
  const actAs = token ? actAsStore.get() : null
  // Starting/ending a session must be called without the header (ImpersonationController).
  if (actAs && !path.includes("/impersonation")) headers["X-Act-As-Company"] = actAs.sessionKey

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  })

  if (res.status === 401 && token && retry) {
    if (await refreshTokens()) return request<T>(path, { method, body, auth, as, headers: extra }, false)
    tokenStore.clear()
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
    }
  }

  if (as === "blob" && res.ok) return (await res.blob()) as T

  const text = await res.text()
  const json = (text ? safeJson(text) : {}) as ApiMessage<T>
  if (!res.ok || json.result === false) {
    throw new ApiError(res.status, json.code, json.message || res.statusText || "Request failed", json.errors)
  }
  return json.data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}
