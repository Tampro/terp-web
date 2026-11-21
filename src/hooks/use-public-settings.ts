"use client"

import * as React from "react"

import { AuthService, type LanguageDto, type PublicSettings } from "@/lib/auth/auth.service"

let settingsCache: Promise<PublicSettings | undefined> | null = null
let languagesCache: Promise<LanguageDto[]> | null = null

/** GET /settings/public (no token): brand title, registration toggle, reCAPTCHA. Cached per page load. */
export function usePublicSettings() {
  const [settings, setSettings] = React.useState<PublicSettings>()
  React.useEffect(() => {
    settingsCache ??= AuthService.publicSettings().catch(() => {
      settingsCache = null
      return undefined
    })
    settingsCache.then(setSettings)
  }, [])
  return settings
}

/** GET /languages (no token): enabled languages for the selector. Falls back to vi/en/ko. */
export function useLanguages() {
  const [languages, setLanguages] = React.useState<LanguageDto[]>(FALLBACK_LANGUAGES)
  React.useEffect(() => {
    languagesCache ??= AuthService.languages().catch(() => {
      languagesCache = null
      return FALLBACK_LANGUAGES
    })
    languagesCache.then((l) => setLanguages(l?.length ? l.filter((x) => x.enabled !== false) : FALLBACK_LANGUAGES))
  }, [])
  return languages
}

const FALLBACK_LANGUAGES: LanguageDto[] = [
  { code: "vi", name: "Tiếng Việt" },
  { code: "en", name: "English" },
  { code: "ko", name: "한국어" },
]
