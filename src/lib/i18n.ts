"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import en from "@/locales/en"
import ko from "@/locales/ko"
import vi from "@/locales/vi"

export type TranslationKey = keyof typeof en
const DICTIONARIES: Record<string, Partial<Record<TranslationKey, string>>> = { en, vi, ko }

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
  let text = DICTIONARIES[language]?.[key] ?? en[key] ?? key
  for (const [k, v] of Object.entries(params ?? {})) text = text.replaceAll(`{${k}}`, String(v))
  return text
}

export function useT() {
  const language = useLanguageStore((s) => s.language)
  return (key: TranslationKey, params?: Record<string, string | number>) => translate(language, key, params)
}
