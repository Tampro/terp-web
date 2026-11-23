"use client"

import * as React from "react"

import { usePublicSettings } from "@/hooks/use-public-settings"
import { request } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useEffectiveUITheme } from "@/providers/ui-theme-provider"
import { BRAND_STORAGE_KEY, brandColor, brandImage, brandMode, useBrandStore, type Brand } from "@/store/brand.store"

/**
 * Applies the brand (manual §3.7 Brand, company brand §19) to the whole app: favicon, LTR/RTL, sidebar style, and —
 * while the user has not picked a colour theme of their own — the theme colour; light/dark is a default in
 * ThemeProvider and the sidebar variant / logos are read by the sidebar and the sign-in shell. Source: a signed-in
 * company user gets GET /settings/company/effective (the company's own value where set, else the platform's); everyone
 * else the platform brand of GET /settings/public. Rendered once in the root layout.
 */
export function BrandApplier() {
  const publicBrand = usePublicSettings()?.brand
  const me = useAuthStore((s) => s.me)
  const companyUser = !!me && !me.superAdmin
  const [company, setCompany] = React.useState<{ key: string; brand?: Brand }>()
  const meKey = companyUser ? `${me?.userId ?? ""}:${me?.companyId ?? ""}` : ""
  React.useEffect(() => {
    if (!companyUser) return
    let cancelled = false
    request<{ brand?: Brand }>("/v1/settings/company/effective")
      .then((e) => !cancelled && setCompany({ key: meKey, brand: e?.brand }))
      .catch(() => !cancelled && setCompany({ key: meKey, brand: undefined }))
    return () => {
      cancelled = true
    }
  }, [companyUser, meKey])
  const brand = companyUser && company?.key === meKey && company.brand ? company.brand : publicBrand
  const setBrand = useBrandStore((s) => s.setBrand)
  React.useEffect(() => setBrand(brand), [brand, setBrand])

  const uiTheme = useEffectiveUITheme()
  const color = brandColor(brand?.themeColor)
  const favicon = brandImage(brand?.faviconUrl)
  const rtl = brand?.layoutDirection === "RTL"
  const style = brand?.sidebarStyle ?? "PLAIN"

  // remembered for the theme script of the next page load (no flash of the template look)
  React.useEffect(() => {
    if (!brand) return
    try {
      localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify({ mode: brandMode(brand) ?? null, color: color ?? null, dir: rtl ? "rtl" : "ltr" }))
    } catch {
      // private mode: the brand still applies once loaded
    }
  }, [brand, color, rtl])

  React.useEffect(() => {
    const root = document.documentElement
    root.dir = rtl ? "rtl" : "ltr"
    root.dataset.sidebarStyle = style.toLowerCase()
  }, [rtl, style])

  // the brand colour only when no colour theme is active (each custom theme has its own palette)
  React.useEffect(() => {
    const root = document.documentElement
    const vars = ["--primary", "--primary-foreground", "--ring", "--sidebar-primary", "--sidebar-primary-foreground", "--sidebar-ring"]
    if (!color || uiTheme) {
      vars.forEach((v) => root.style.removeProperty(v))
      return
    }
    for (const v of ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"]) root.style.setProperty(v, color)
    root.style.setProperty("--primary-foreground", "#ffffff")
    root.style.setProperty("--sidebar-primary-foreground", "#ffffff")
  }, [color, uiTheme])

  React.useEffect(() => {
    if (!favicon) return
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"][data-brand]')
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      link.dataset.brand = "1"
      document.head.appendChild(link)
    }
    link.href = favicon
    return () => link?.remove()
  }, [favicon])

  return null
}
