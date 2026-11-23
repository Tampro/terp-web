"use client"

import * as React from "react"
import { Download, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { RequireSuperAdmin } from "@/components/common/require-super-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import type { Row } from "@/lib/hrm/hrm.service"
import { useLanguageStore, useT } from "@/lib/i18n"
import { csvCell, INQUIRY_STATUSES, SiteService, type Inquiry } from "@/lib/site/site.service"

import { CrudSection, errorMessage, TabbedPage, type CrudConfig, type FieldDef } from "../hrm/_components/crud-kit"
import { LandingEditor } from "./_components/landing-editor"

export default function WebsitePage() {
  return (
    <RequireSuperAdmin>
      <React.Suspense>
        <Website />
      </React.Suspense>
    </RequireSuperAdmin>
  )
}

/** §3.4 public website CMS (super admin): landing page sections, custom pages, contact inquiries, newsletter. */
function Website() {
  const t = useT()
  return (
    <TabbedPage
      title={t("menu.website")}
      description={t("site.subtitle")}
      tabs={[
        { key: "landing", label: "site.tab.landing", content: () => <LandingEditor /> },
        { key: "pages", label: "site.tab.pages", content: () => <Pages /> },
        { key: "inquiries", label: "site.tab.inquiries", content: () => <Inquiries /> },
        { key: "newsletter", label: "site.tab.newsletter", content: () => <Newsletter /> },
      ]}
    />
  )
}

const PAGE_FIELDS: FieldDef[] = [
  { name: "title", label: "site.f.title", required: true, max: 200 },
  { name: "sortOrder", label: "site.f.sortOrder", type: "number", min: 0, max: 100000 },
  { name: "published", label: "site.f.published", type: "switch" },
  { name: "metaTitle", label: "site.f.metaTitle", max: 200, check: (v) => (String(v.metaTitle ?? "").length > 60 ? "site.metaTitleLong" : undefined) },
  { name: "metaDescription", label: "site.f.metaDescription", type: "textarea", max: 500, full: true, check: (v) => (String(v.metaDescription ?? "").length > 160 ? "site.metaDescLong" : undefined) },
  { name: "content", label: "site.f.contentHtml", type: "textarea", required: true, max: 500000, full: true },
]

function Pages() {
  const t = useT()
  const cfg: CrudConfig = {
    id: "site-pages",
    load: SiteService.pages as CrudConfig["load"],
    keyword: true,
    manage: true,
    rowName: (r) => String(r.title ?? ""),
    createLabel: "site.addPage",
    fields: PAGE_FIELDS,
    defaults: { published: true, sortOrder: 0 },
    // the list carries a plain-text preview only
    fetchRow: (r) => SiteService.page(String(r.id)) as Promise<Row>,
    save: SiteService.savePage,
    remove: SiteService.removePage,
    columns: [
      { label: "site.f.title", path: "title" },
      {
        label: "site.f.slug",
        render: (r) => (
          <a href={`/site/${r.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:underline">
            /site/{String(r.slug)} <ExternalLink className="size-3" />
          </a>
        ),
      },
      { label: "site.f.published", render: (r) => <Badge variant={r.published ? "default" : "outline"}>{t(r.published ? "site.published" : "site.draft")}</Badge> },
      { label: "site.f.preview", render: (r) => <span className="text-muted-foreground line-clamp-1 max-w-md text-xs">{String(r.preview ?? "")}</span> },
      { label: "site.created", path: "createdDate", kind: "date" },
    ],
  }
  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">{t("site.pagesHint")}</p>
      <CrudSection config={cfg} />
    </div>
  )
}

function Inquiries() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [viewing, setViewing] = React.useState<Inquiry>()
  const cfg: CrudConfig = {
    id: "site-inquiries",
    load: SiteService.inquiries as CrudConfig["load"],
    keyword: true,
    manage: true,
    statuses: [...INQUIRY_STATUSES],
    rowName: (r) => `${r.name ?? ""} · ${r.subject ?? ""}`,
    remove: SiteService.removeInquiry,
    onRowClick: (r) => setViewing(r as Inquiry),
    columns: [
      { label: "site.f.name", path: "name" },
      { label: "site.f.email", path: "email" },
      { label: "site.f.subject", path: "subject" },
      { label: "site.status", path: "status", kind: "status" },
      { label: "site.created", path: "createdDate", kind: "date" },
      { label: "site.lastReplied", path: "lastRepliedAt", kind: "date" },
    ],
    actions: [
      {
        key: "reply",
        label: "site.reply",
        when: () => true,
        fields: [
          { name: "subject", label: "site.f.subject", required: true, max: 255, full: true },
          { name: "message", label: "site.f.message", type: "textarea", required: true, max: 10000, full: true },
        ],
        initial: (r) => ({ subject: `Re: ${r.subject ?? ""}`.slice(0, 255) }),
        run: (r, b) => SiteService.replyInquiry(String(r.id), b as { subject: string; message: string }),
      },
      {
        key: "status",
        label: "site.changeStatus",
        when: () => true,
        fields: [{ name: "status", label: "site.status", type: "select", required: true, options: INQUIRY_STATUSES.map((s) => ({ value: s, label: t(`hr.status.${s}`) })) }],
        initial: (r) => ({ status: r.status }),
        run: (r, b) => SiteService.setInquiryStatus(String(r.id), String(b.status)),
      },
    ],
  }
  return (
    <>
      <CrudSection config={cfg} />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{viewing?.subject}</DialogTitle>
            <DialogDescription>
              {viewing?.name} · {viewing?.email}
              {viewing?.phone ? ` · ${viewing.phone}` : ""} · {formatDate(viewing?.createdDate, language, true)}
            </DialogDescription>
          </DialogHeader>
          <p className="max-h-[60vh] overflow-auto text-sm whitespace-pre-wrap" data-testid="site-inquiry-message">
            {viewing?.message}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Newsletter() {
  const t = useT()
  const [busy, setBusy] = React.useState(false)
  const exportCsv = async () => {
    setBusy(true)
    try {
      const rows = await SiteService.allSubscribers()
      const csv = ["email,subscribed_at", ...rows.map((r) => [csvCell(r.email), csvCell(r.subscribedDate)].join(","))].join("\r\n")
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
      const a = Object.assign(document.createElement("a"), { href: url, download: "newsletter-subscribers.csv" })
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const cfg: CrudConfig = {
    id: "site-newsletter",
    load: SiteService.subscribers as CrudConfig["load"],
    keyword: true,
    manage: true,
    rowName: (r) => String(r.email ?? ""),
    remove: SiteService.removeSubscriber,
    toolbar: (
      <Button variant="outline" onClick={exportCsv} disabled={busy}>
        <Download /> {t("site.export")}
      </Button>
    ),
    columns: [
      { label: "site.f.email", path: "email" },
      { label: "site.subscribedAt", path: "subscribedDate", kind: "date" },
    ],
  }
  return <CrudSection config={cfg} />
}
