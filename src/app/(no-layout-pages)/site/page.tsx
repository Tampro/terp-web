"use client"

import * as React from "react"

import { LandingView } from "@/components/site/landing-view"
import { CookieBanner } from "@/components/site/cookie-banner"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { str } from "@/lib/site/site.sections"
import { SiteService, type PublicLanding } from "@/lib/site/site.service"

/**
 * §3.4 public website at /site, no sign-in: GET /v1/public/site/landing (displayed blocks in order, their content, plans,
 * published pages). 404 SITE_003 while System Settings → Landing Page is off. advanced.customCss is applied;
 * advanced.customJs is never executed by this app.
 */
export default function PublicSitePage() {
  const t = useT()
  const [data, setData] = React.useState<PublicLanding | null>()
  const [error, setError] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    SiteService.publicLanding()
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        if (cancelled) return
        setData(null)
        setError(e instanceof ApiError && e.code === "SITE_003" ? t("site.v.off") : e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [t])
  if (data === undefined) return <Skeleton className="m-8 h-96" />
  if (!data) return <p className="p-10 text-center text-slate-600">{error}</p>
  const css = str(data.sections?.advanced?.customCss)
  return (
    <>
      {css && <style>{css}</style>}
      <LandingView sections={data.sections ?? {}} order={data.order ?? []} plans={data.plans ?? []} pages={data.pages ?? []} />
      <CookieBanner />
    </>
  )
}
