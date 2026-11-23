"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import en from "@/locales/en"
import ko from "@/locales/ko"
import vi from "@/locales/vi"

export type TranslationKey = keyof typeof en
type Dictionary = Partial<Record<TranslationKey, string>>
/** vi / en / ko ship with the app; other languages come from the backend (Language Management). */
export const BUILT_IN_LANGUAGES = ["vi", "en", "ko"]
const DICTIONARIES: Record<string, Dictionary> = { en, vi, ko }

/**
 * Labels of the languages added in Language Management, loaded at runtime from GET /v1/languages/{code}/labels by
 * <RemoteLabels> (components/remote-labels.tsx). A missing key falls back to English.
 */
export const useRemoteLabels = create<{ labels: Record<string, Dictionary>; set: (code: string, d: Dictionary) => void }>()((set) => ({
  labels: {},
  set: (code, d) => set((s) => ({ labels: { ...s.labels, [code]: d } })),
}))

interface LanguageState {
  language: string
  setLanguage: (language: string) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "vi",
      setLanguage: (language) => set({ language }),
    }),
    { name: "erp.language" }
  )
)

export function translate(language: string, key: TranslationKey, params?: Record<string, string | number>) {
  const dict = DICTIONARIES[language] ?? useRemoteLabels.getState().labels[language]
  let text = dict?.[key] ?? en[key] ?? key
  for (const [k, v] of Object.entries(params ?? {})) text = text.replaceAll(`{${k}}`, String(v))
  return text
}

export function useT() {
  const language = useLanguageStore((s) => s.language)
  // re-render once the labels of a runtime language arrive
  useRemoteLabels((s) => s.labels[language])
  return (key: TranslationKey, params?: Record<string, string | number>) => translate(language, key, params)
}
