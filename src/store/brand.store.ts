import { create } from "zustand"

/**
 * The brand that applies to the current viewer (manual §3.7 Brand, §19 company brand): the company's effective brand
 * for a signed-in company user (GET /settings/company/effective), else the platform's (GET /settings/public).
 * Set by <BrandApplier>. Brand values are DEFAULTS: a user's own choice in the Theme Customizer (light/dark, colour
 * theme) wins. The defaults are also kept in localStorage "erp.brand" so the theme script in the root layout can apply
 * them before the first paint of the next page load.
 */
export interface Brand {
  logoDarkUrl?: string | null
  logoLightUrl?: string | null
  faviconUrl?: string | null
  titleText?: string | null
  footerText?: string | null
  themeColor?: string | null
  sidebarVariant?: "INSET" | "FLOATING" | "MINIMAL" | null
  sidebarStyle?: "PLAIN" | "COLORED" | "GRADIENT" | null
  layoutDirection?: "LTR" | "RTL" | null
  themeMode?: "LIGHT" | "DARK" | "SYSTEM" | null
  companyMobile?: string | null
  companyAddress?: string | null
}

export const BRAND_STORAGE_KEY = "erp.brand"

export const useBrandStore = create<{ brand?: Brand; setBrand: (b?: Brand) => void }>()((set) => ({
  brand: undefined,
  setBrand: (brand) => set({ brand }),
}))

/** Preset theme colours of the Brand settings (pattern blue|green|purple|orange|red|teal|#RRGGBB). */
export const BRAND_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  green: "#10b981",
  purple: "#8b5cf6",
  orange: "#f97316",
  red: "#ef4444",
  teal: "#14b8a6",
}

export function brandColor(v?: string | null) {
  if (!v) return undefined
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  return BRAND_COLORS[v]
}

export const brandMode = (b?: Brand) => (b?.themeMode === "DARK" ? "dark" : b?.themeMode === "SYSTEM" ? "system" : b?.themeMode === "LIGHT" ? "light" : undefined)

/** http(s) or in-site image only */
export const brandImage = (v?: string | null) => (v && /^(https?:\/\/|\/(?!\/))/i.test(v.trim()) ? v.trim() : undefined)
