import type { NextConfig } from "next"

// The ERP gateway is proxied under /api so the browser stays same-origin (no CORS).
// Emailed links (reset password, verify email) point to erp.app-url = http://localhost:5173, hence `next dev -p 5173`.
const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:18080"

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_TARGET}/api/:path*` }]
  },
}

export default nextConfig
