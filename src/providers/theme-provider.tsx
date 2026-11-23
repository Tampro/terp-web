"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react"

import { brandMode, useBrandStore } from "@/store/brand.store"

type Theme = "light" | "dark" | "system"

type Ctx = {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<Ctx | null>(null)
const STORAGE_KEY = "theme"

// window does not exist during server rendering, so guard it
const getSystem = (): "light" | "dark" =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"

/* Saved choice (localStorage): changed by setTheme here or by another tab (storage event). */
const savedListeners = new Set<() => void>()
function subscribeSaved(onChange: () => void) {
  savedListeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    savedListeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}
function readSaved(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === "light" || saved === "dark" || saved === "system" ? saved : null
  } catch {
    return null
  }
}

/* OS colour scheme */
function subscribeSystem(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
}) {
  // The user's saved choice wins; else the brand's light/dark mode (§3.7 Brand, a default only); else defaultTheme.
  // Server render and hydration use defaultTheme / "light"; the browser values follow right after.
  const brandDefault = useBrandStore((s) => brandMode(s.brand))
  const saved = useSyncExternalStore(subscribeSaved, readSaved, () => null)
  const theme: Theme = saved ?? brandDefault ?? defaultTheme
  const systemTheme = useSyncExternalStore(subscribeSystem, getSystem, () => "light" as const)

  const resolvedTheme = theme === "system" ? systemTheme : theme

  useEffect(() => {
    const root = document.documentElement
    const style = document.createElement("style")
    style.appendChild(
      document.createTextNode("*,*::before,*::after{transition:none!important}")
    )
    document.head.appendChild(style)

    // only touch light/dark, never the custom theme classes
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)

    window.getComputedStyle(document.body)
    setTimeout(() => document.head.removeChild(style), 1)
  }, [resolvedTheme])

  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {}
    savedListeners.forEach((l) => l())
  }

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}