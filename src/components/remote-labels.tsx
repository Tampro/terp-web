"use client"

import * as React from "react"

import { BUILT_IN_LANGUAGES, useLanguageStore, useRemoteLabels } from "@/lib/i18n"
import { LanguageService } from "@/lib/language/language.service"

/**
 * Loads the labels of the chosen language when it is not one the app ships (vi/en/ko): GET /v1/languages/{code}/labels
 * (no token). Rendered once in the root layout. A failure (language disabled or deleted) leaves an empty dictionary, so
 * every text falls back to English instead of retrying on each render.
 */
export function RemoteLabels() {
  const language = useLanguageStore((s) => s.language)
  const loaded = useRemoteLabels((s) => language in s.labels)
  React.useEffect(() => {
    if (BUILT_IN_LANGUAGES.includes(language) || loaded) return
    let cancelled = false
    LanguageService.published(language)
      .then((d) => !cancelled && useRemoteLabels.getState().set(language, d ?? {}))
      .catch(() => !cancelled && useRemoteLabels.getState().set(language, {}))
    return () => {
      cancelled = true
    }
  }, [language, loaded])
  return null
}
