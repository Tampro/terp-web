"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { HR, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { CrudSection, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig } from "../_components/crud-kit"

export default function AnnouncementsPage() {
  return (
    <React.Suspense>
      <Announcements />
    </React.Suspense>
  )
}

/** §15 announcements: Draft / Active / Inactive, audience (company-wide or branches / departments), featured and high priority. */
function Announcements() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("ANNOUNCEMENT_MANAGE")
  const categories = toSelect(useOptions("announcementCategories", HrOptions.announcementCategories))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const departments = toSelect(useOptions("departments", () => HrOptions.departments()))
  const cfg: CrudConfig = {
    id: "announcements",
    load: HR.announcements.list,
    keyword: true,
    statuses: ["DRAFT", "ACTIVE", "INACTIVE"],
    columns: [
      {
        label: "hr.f.title",
        render: (r) => (
          <div className="grid gap-0.5">
            <span className="font-medium">
              {String(r.title ?? "")} {r.highPriority ? <Badge variant="destructive">{t("hr.ann.highPriority")}</Badge> : null} {r.featured ? <Badge variant="secondary">{t("hr.ann.featured")}</Badge> : null}
            </span>
            {!!r.shortDescription && <span className="text-muted-foreground line-clamp-1 text-xs">{String(r.shortDescription)}</span>}
          </div>
        ),
      },
      { label: "hr.f.category", path: "category.name" },
      { label: "hr.f.period", render: (r) => `${formatDate(String(r.startDate ?? ""), language)} → ${formatDate(String(r.endDate ?? ""), language)}` },
      { label: "hr.ann.audience", render: (r) => (r.companyWide ? t("hr.ann.companyWide") : [...((r.branches as { name?: string }[]) ?? []), ...((r.departments as { name?: string }[]) ?? [])].map((x) => x.name).join(", ") || "-") },
      { label: "hr.ann.state", render: (r) => (r.state ? t(`hr.annState.${String(r.state)}` as TranslationKey) : "-") },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "hr.ann.create",
    fields: [
      { name: "title", label: "hr.f.title", required: true, max: 200, full: true },
      { name: "categoryId", label: "hr.f.category", type: "select", required: true, numeric: true, options: categories },
      { name: "status", label: "hr.f.status", type: "select", options: (["DRAFT", "ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
      { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
      { name: "endDate", label: "hr.f.endDate", type: "date", required: true, check: (v) => (v.startDate && v.endDate && String(v.endDate) < String(v.startDate) ? "hr.v.endAfterStart" : undefined) },
      { name: "shortDescription", label: "hr.f.shortDescription", max: 500, full: true },
      { name: "content", label: "hr.f.content", type: "textarea", required: true, max: 100000 },
      { name: "featured", label: "hr.ann.featured", type: "switch" },
      { name: "highPriority", label: "hr.ann.highPriority", type: "switch" },
      { name: "companyWide", label: "hr.ann.companyWide", type: "switch" },
      { name: "branchIds", label: "hr.f.branches", type: "multi", options: branches, hidden: (v) => !!v.companyWide },
      { name: "departmentIds", label: "hr.f.departments", type: "multi", options: departments, hidden: (v) => !!v.companyWide },
    ],
    defaults: { status: "DRAFT", companyWide: true },
    toValues: (r) => ({
      ...r,
      categoryId: pick(r, "category.id"),
      branchIds: ((r.branches as { id?: string }[]) ?? []).map((b) => b.id),
      departmentIds: ((r.departments as { id?: string }[]) ?? []).map((d) => d.id),
    }),
    fetchRow: (r) => HR.announcements.get(r.id ?? ""),
    save: HR.announcements.save,
    remove: HR.announcements.remove,
    actions: [
      { key: "activate", label: "hr.activate", icon: <Play className="size-4" />, when: (r: Row) => r.status !== "ACTIVE", run: (r) => HR.announcements.put(r.id ?? "", "activate") },
      { key: "deactivate", label: "hr.deactivate", icon: <Pause className="size-4" />, when: (r: Row) => r.status === "ACTIVE", run: (r) => HR.announcements.put(r.id ?? "", "deactivate") },
    ],
    manage,
  }
  return <TabbedPage title={t("menu.hr.announcements")} description={t("hr.ann.subtitle")} tabs={[{ key: "list", label: "menu.hr.announcements", content: () => <CrudSection config={cfg} /> }]} />
}
