import type { Metadata } from "next"

// Server-side reads for the SEO tags of the public website (/site pages only: the rest of the app stays client-rendered,
// approved by the user 2026-11-23). Calls the gateway directly (the browser's /api rewrite target), public endpoints
// only, no token, cached 60 s. Any failure returns undefined: the page then gets the default tags and still renders.

const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:18080"

async function get<T>(path: string): Promise<T | undefined> {
  try {
    const res = await fetch(`${API_TARGET}/api${path}`, { next: { revalidate: 60 }, headers: { Accept: "application/json" } })
    if (!res.ok) return undefined
    const body = (await res.json()) as { result?: boolean; data?: T }
    return body?.result ? body.data : undefined
  } catch {
    return undefined
  }
}

interface PublicSeo {
  brand?: { titleText?: string | null; faviconUrl?: string | null }
  seo?: { metaKeywords?: string | null; metaDescription?: string | null; metaImageUrl?: string | null }
}
interface PublicPage {
  title?: string
  metaTitle?: string | null
  metaDescription?: string | null
}

const httpUrl = (v?: string | null) => (v && /^https?:\/\/.+/i.test(v.trim()) ? v.trim() : undefined)

/** Title, description, keywords, Open Graph and Twitter tags; /site is indexable (the root layout says noindex). */
export async function siteMetadata(slug?: string): Promise<Metadata> {
  const [settings, page] = await Promise.all([
    get<PublicSeo>("/v1/settings/public"),
    slug ? get<PublicPage>(`/v1/public/site/pages/${encodeURIComponent(slug)}`) : Promise.resolve(undefined),
  ])
  const brand = settings?.brand?.titleText || "ERP"
  const pageTitle = page?.metaTitle || page?.title
  const title = pageTitle ? `${pageTitle} | ${brand}` : brand
  const description = page?.metaDescription || settings?.seo?.metaDescription || undefined
  const image = httpUrl(settings?.seo?.metaImageUrl)
  const keywords = settings?.seo?.metaKeywords
    ?.split(",")
    .map((k) => k.trim())
    .filter(Boolean)
  return {
    // absolute: the root layout's "%s | ERP" template must not add a second brand
    title: { absolute: title },
    description,
    keywords: keywords?.length ? keywords : undefined,
    robots: { index: true, follow: true },
    openGraph: { type: "website", title, description, images: image ? [{ url: image, width: 1200, height: 630 }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  }
}
