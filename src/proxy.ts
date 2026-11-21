import { NextResponse, type NextRequest } from "next/server"

/**
 * /api is rewritten to the ERP gateway (next.config.ts). The browser call is same-origin, but the gateway's CORS
 * list (ERP_CORS_ORIGINS) only knows http://localhost:5173 and answers 403 to any other Origin (127.0.0.1, LAN IP).
 * Dropping Origin on the proxied request makes it a plain server-to-server call.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.delete("origin")
  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: "/api/:path*" }
