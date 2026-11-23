"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { CookieBanner } from "@/components/site/cookie-banner"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n"
import { SiteService, type SitePage } from "@/lib/site/site.service"

/**
 * §3.4 a published custom page at /site/{slug} (GET /v1/public/site/pages/{slug}, 404 SITE_004 for drafts). The content
 * is HTML sanitized by the backend on save (SiteService.sanitize: jsoup relaxed safelist, no script, event handler or
 * javascript: link), so it is rendered as HTML.
 */
export default function PublicCustomPage() {
  const { slug } = useParams<{ slug: string }>()
  const t = useT()
  const [page, setPage] = React.useState<SitePage | null>()
  const [error, setError] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    SiteService.publicPage(slug)
      .then((p) => {
        if (cancelled) return
        setPage(p)
        if (p.metaTitle || p.title) document.title = String(p.metaTitle || p.title)
      })
      .catch((e) => {
        if (cancelled) return
        setPage(null)
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [slug])
  return (
    <div className="min-h-screen bg-white px-4 py-10 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/site" className="text-sm text-blue-600 hover:underline">
          ← {t("site.v.home")}
        </Link>
        {page === undefined && <Skeleton className="mt-6 h-64" />}
        {page === null && <p className="mt-10 text-center text-slate-600">{error}</p>}
        {page && (
          <article className="mt-6">
            <h1 className="mb-6 text-3xl font-bold">{page.title}</h1>
            <div
              data-testid="site-page-content"
              className="space-y-4 [&_a]:text-blue-600 [&_a]:underline [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-6 [&_ol]:list-decimal [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: page.content ?? "" }}
            />
          </article>
        )}
      </div>
      <CookieBanner />
    </div>
  )
}
