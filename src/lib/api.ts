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

type RequestOptions = { method?: string; body?: unknown; auth?: boolean }

/** Calls the backend, unwraps the envelope, refreshes once on 401, throws ApiError otherwise. */
export async function request<T>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {},
  retry = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Accept-Language": useLanguageStore.getState().language,
  }
  const isForm = typeof FormData !== "undefined" && body instanceof FormData
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json"
  const token = auth ? tokenStore.access : null
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  })

  if (res.status === 401 && token && retry) {
    if (await refreshTokens()) return request<T>(path, { method, body, auth }, false)
    tokenStore.clear()
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
    }
  }

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
