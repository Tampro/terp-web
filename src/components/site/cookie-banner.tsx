"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { usePublicSettings } from "@/hooks/use-public-settings"
import { request } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { safeHref } from "@/lib/site/site.sections"

// Cookie consent banner of the public website (manual §3.7 Cookie). Texts from GET /v1/settings/public → cookie. The
// visitor's choice is kept in this browser (localStorage) and sent to POST /v1/public/site/cookie-consent, which records
// it only while Enable Logging is on. Proposal: the optional categories (analytics, marketing) are this app's; the backend
// accepts any [a-z_]{1,30} name and always adds "necessary".

const KEY = "erp.cookieConsent"
const OPTIONAL = ["analytics", "marketing"] as const
type Choice = "ACCEPT_ALL" | "NECESSARY_ONLY" | "CUSTOM"

const listeners = new Set<() => void>()
function read() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

export function CookieBanner() {
  const t = useT()
  const cookie = usePublicSettings()?.cookie
  // null on the server render and until the browser value is read: no banner flash
  const stored = React.useSyncExternalStore(subscribe, read, () => "pending")
  const [custom, setCustom] = React.useState(false)
  const [picked, setPicked] = React.useState<string[]>([])
  if (stored !== null || !cookie) return null

  const choose = (choice: Choice, categories: string[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ choice, categories, at: new Date().toISOString() }))
    } catch {
      // private mode: the banner simply comes back next time
    }
    listeners.forEach((l) => l())
    // recording is best effort: the visitor's choice applies either way
    request("/v1/public/site/cookie-consent", { method: "POST", body: { choice, categories }, auth: false }).catch(() => undefined)
  }
  const contact = safeHref(cookie.contactUrl)
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-0 bottom-0 z-50 border-t bg-white p-4 text-slate-800 shadow-2xl sm:p-6">
      <div className="mx-auto grid max-w-5xl gap-3">
        <h2 id="cookie-title" className="text-lg font-semibold">
          {cookie.cookieTitle || t("cookie.title")}
        </h2>
        <p className="text-sm whitespace-pre-line text-slate-600">{cookie.cookieDescription || t("cookie.description")}</p>
        {custom && (
          <div className="grid gap-3 rounded-md border p-3" data-testid="cookie-custom">
            <div className="flex items-start gap-2">
              <Checkbox id="cookie-necessary" checked disabled />
              <div>
                <Label htmlFor="cookie-necessary">{cookie.strictlyTitle || t("cookie.necessary")}</Label>
                {cookie.strictlyDescription && <p className="text-xs text-slate-500">{cookie.strictlyDescription}</p>}
              </div>
            </div>
            {OPTIONAL.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <Checkbox id={`cookie-${c}`} checked={picked.includes(c)} onCheckedChange={(v) => setPicked((p) => (v ? [...p, c] : p.filter((x) => x !== c)))} />
                <Label htmlFor={`cookie-${c}`}>{t(`cookie.cat.${c}`)}</Label>
              </div>
            ))}
          </div>
        )}
        {(cookie.contactDescription || contact) && (
          <p className="text-xs text-slate-500">
            {cookie.contactDescription}{" "}
            {contact && (
              <a href={contact} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                {t("cookie.contact")}
              </a>
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => choose("ACCEPT_ALL", [...OPTIONAL])}>{t("cookie.acceptAll")}</Button>
          <Button variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={() => choose("NECESSARY_ONLY", [])}>
            {t("cookie.necessaryOnly")}
          </Button>
          {custom ? (
            <Button variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={() => choose("CUSTOM", picked)}>
              {t("cookie.save")}
            </Button>
          ) : (
            <Button variant="ghost" className="text-slate-700 hover:bg-slate-100" onClick={() => setCustom(true)}>
              {t("cookie.customize")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
