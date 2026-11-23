"use client"

import { useEffect } from "react"

import { useTheme } from "@/providers/theme-provider"
import { useBrandStore } from "@/store/brand.store"
import { useUIThemeStore } from "@/store/ui-theme.store"

const CUSTOM_THEMES = ["dark-blue", "classic-light", "gaussian-black", "semi-dark"]

/**
 * The colour theme in use: the user's own pick (Theme Customizer) when they made one; otherwise none when a brand
 * applies (the brand's colour and light/dark mode are used), else the template default.
 */
export function useEffectiveUITheme() {
  const { theme, chosen } = useUIThemeStore()
  const brand = useBrandStore((s) => s.brand)
  return chosen || !brand ? theme : ""
}

export default function UIThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useEffectiveUITheme()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const html = document.documentElement
    CUSTOM_THEMES.forEach((t) => html.classList.remove(t))
    // a custom theme carries its own light/dark look (as before); "" = no custom theme: the light/dark class of
    // ThemeProvider and the brand colour apply
    html.classList.remove("dark", "light")
    html.classList.add(theme || resolvedTheme)
  }, [theme, resolvedTheme])

  return <>{children}</>
}
