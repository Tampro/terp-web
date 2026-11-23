import type { Metadata } from "next"

import { siteMetadata } from "@/lib/site/site.server"

import PublicCustomPage from "./page-view"

/** /site/{slug}: the custom page's meta title / description rendered on the server; the page is a client component. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return siteMetadata(slug)
}

export default function Page() {
  return <PublicCustomPage />
}
