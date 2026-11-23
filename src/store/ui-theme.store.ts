import { create } from "zustand"
import { persist } from "zustand/middleware"

type UIThemeState = {
  theme: string
  /** true once the user picked a colour theme (or reset it) in the Theme Customizer: the brand no longer overrides it */
  chosen: boolean
  setTheme: (t: string) => void
}

export const useUIThemeStore = create<UIThemeState>()(
  persist(
    (set) => ({
      theme: "dark-blue", // template default, used when no brand applies
      chosen: false,
      setTheme: (theme) => set({ theme, chosen: true }),
    }),
    { name: "ui-theme" } // localStorage key
  )
)
