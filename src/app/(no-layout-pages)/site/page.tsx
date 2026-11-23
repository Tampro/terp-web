import type { Metadata } from "next"

import { siteMetadata } from "@/lib/site/site.server"

import PublicSitePage from "./site-view"

/** /site: SEO tags rendered on the server (crawlers see them without JavaScript); the page itself is a client component. */
export function generateMetadata(): Promise<Metadata> {
  return siteMetadata()
}

export default function Page() {
  return <PublicSitePage />
}
