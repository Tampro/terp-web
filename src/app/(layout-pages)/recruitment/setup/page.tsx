"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { Row } from "@/lib/hrm/hrm.service"
import { CATALOG_KINDS, QUESTION_TYPES, REC, RecOptions, RecruitmentService, TASK_CATEGORIES, type CareerSettings } from "@/lib/recruitment/recruitment.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, Field, PlainSelect, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../../hrm/_components/crud-kit"

const name = (r: Row) => String(r.name ?? r.question ?? r.taskName ?? "")
/** Comma / new-line separated text ↔ list (question options, template variables). */
const split = (v: unknown) =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)

export default function RecruitmentSetupPage() {
  return (
    <React.Suspense>
      <Setup />
    </React.Suspense>
  )
}

/** §17 configuration: job types / categories, sources, interview types, job locations, interview rounds, custom questions, onboarding checklists + items, offer letter templates, career portal. */
function Setup() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("RECRUITMENT_MANAGE")
  const postings = toSelect(useOptions("rec:postings", RecOptions.postings))
  const checklists = toSelect(useOptions("rec:checklists", RecOptions.checklists))
  const active = (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) }))
  const status: FieldDef = { name: "status", label: "hr.f.status", type: "select", options: active }

  const locations: CrudConfig = {
    id: "locations",
    load: REC.locations.list,
    countsPath: "/v1/recruitment/job-locations/status-counts",
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "rc.remote", path: "remote", kind: "bool" },
      { label: "hr.f.address", render: (r) => [r.address, r.city, r.country].filter(Boolean).join(", ") || "-" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "rc.location.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "remote", label: "rc.remote", type: "switch" },
      { name: "address", label: "hr.f.address", max: 255, full: true, hidden: (v) => !!v.remote },
      { name: "city", label: "hr.f.city", max: 100, hidden: (v) => !!v.remote },
      { name: "state", label: "hr.f.state", max: 100, hidden: (v) => !!v.remote },
      { name: "country", label: "hr.f.country", max: 100 },
      { name: "postalCode", label: "hr.f.postalCode", max: 20, hidden: (v) => !!v.remote },
      status,
    ],
    defaults: { status: "ACTIVE" },
    save: REC.locations.save,
    remove: REC.locations.remove,
    invalidates: true,
    manage,
  }
  const rounds: CrudConfig = {
    id: "rounds",
    load: REC.rounds.list,
    countsPath: "/v1/recruitment/interview-rounds/status-counts",
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "rc.job", render: (r) => String(pick(r, "job.title") ?? "-") },
      { label: "rc.sequence", path: "sequenceNumber" },
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "rc.round.create",
    fields: [
      { name: "jobPostingId", label: "rc.job", type: "select", required: true, numeric: true, options: postings, full: true },
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "sequenceNumber", label: "rc.sequence", type: "number", required: true, min: 1, max: 100 },
      status,
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE", sequenceNumber: "1" },
    toValues: (r) => ({ ...r, jobPostingId: pick(r, "job.id") }),
    save: REC.rounds.save,
    remove: REC.rounds.remove,
    invalidates: true,
    manage,
  }
  const questions: CrudConfig = {
    id: "questions",
    load: REC.questions.list,
    keyword: true,
    columns: [
      { label: "rc.question", path: "question" },
      { label: "le.type", render: (r) => t(`rc.qtype.${String(r.type)}` as TranslationKey) },
      { label: "rc.options", render: (r) => ((r.options as string[] | undefined) ?? []).join(", ") || "-" },
      { label: "hr.f.required", path: "required", kind: "bool" },
    ],
    rowName: name,
    createLabel: "rc.question.create",
    fields: [
      { name: "question", label: "rc.question", required: true, max: 1000, full: true },
      { name: "type", label: "le.type", type: "select", required: true, options: QUESTION_TYPES.map((x) => ({ value: x, label: t(`rc.qtype.${x}`) })) },
      { name: "required", label: "hr.f.required", type: "switch" },
      {
        name: "options",
        label: "rc.optionsHint",
        type: "textarea",
        full: true,
        hidden: (v) => !["SELECT", "RADIO", "CHECKBOX"].includes(String(v.type)),
        check: (v) => (["SELECT", "RADIO", "CHECKBOX"].includes(String(v.type)) && split(v.options).length < 2 ? "rc.v.options" : undefined),
      },
    ],
    defaults: { type: "TEXT" },
    toValues: (r) => ({ ...r, options: ((r.options as string[] | undefined) ?? []).join("\n") }),
    save: (id, b) => REC.questions.save(id, { ...b, options: b.options ? split(b.options) : [] }),
    remove: REC.questions.remove,
    invalidates: true,
    manage,
  }
  const checklistCfg: CrudConfig = {
    id: "checklists",
    load: REC.checklists.list,
    countsPath: "/v1/recruitment/onboarding-checklists/status-counts",
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "rc.items", path: "items" },
      { label: "rc.default", path: "defaultChecklist", kind: "bool" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "rc.checklist.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      status,
      { name: "defaultChecklist", label: "rc.default", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE" },
    save: REC.checklists.save,
    remove: REC.checklists.remove,
    invalidates: true,
    manage,
  }
  const items: CrudConfig = {
    id: "items",
    load: REC.items.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "rc.checklist", path: "checklist.name" },
      { label: "rc.task", path: "taskName" },
      { label: "hr.f.category", render: (r) => t(`rc.cat.${String(r.category)}` as TranslationKey) },
      { label: "rc.role", path: "assignedToRole" },
      { label: "rc.dueDay", path: "dueDay" },
      { label: "hr.f.required", path: "required", kind: "bool" },
    ],
    rowName: name,
    createLabel: "rc.item.create",
    fields: [
      { name: "checklistId", label: "rc.checklist", type: "select", required: true, numeric: true, options: checklists },
      { name: "taskName", label: "rc.task", required: true, max: 200 },
      { name: "category", label: "hr.f.category", type: "select", required: true, options: TASK_CATEGORIES.map((x) => ({ value: x, label: t(`rc.cat.${x}`) })) },
      { name: "assignedToRole", label: "rc.role", max: 100 },
      { name: "dueDay", label: "rc.dueDayHint", type: "number", min: 0, max: 365 },
      status,
      { name: "required", label: "hr.f.required", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE", category: "HR", required: true },
    toValues: (r) => ({ ...r, checklistId: pick(r, "checklist.id") }),
    save: REC.items.save,
    remove: REC.items.remove,
    manage,
  }
  const templates: CrudConfig = {
    id: "templates",
    load: REC.templates.list,
    countsPath: "/v1/recruitment/offer-templates/status-counts",
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "rc.variables", render: (r) => ((r.variables as string[] | undefined) ?? []).map((v) => `{{${v}}}`).join(" ") || "-" },
      { label: "rc.preview", render: (r) => <span className="line-clamp-2 max-w-80 text-xs">{String(r.contentPreview ?? "")}</span> },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "rc.template.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      status,
      { name: "variables", label: "rc.variablesHint", max: 2000, full: true },
      { name: "content", label: "rc.content", type: "textarea", required: true, max: 200000 },
    ],
    defaults: { status: "ACTIVE" },
    fetchRow: (r) => REC.templates.get(r.id ?? ""),
    toValues: (r) => ({ ...r, variables: ((r.variables as string[] | undefined) ?? []).join(", ") }),
    save: (id, b) => REC.templates.save(id, { ...b, variables: split(b.variables).join(",") || undefined }),
    remove: REC.templates.remove,
    invalidates: true,
    manage,
  }
  return (
    <TabbedPage
      title={t("menu.rc.setup")}
      description={t("rc.setup.subtitle")}
      tabs={[
        { key: "catalogs", label: "rc.catalogs", content: () => <CatalogTab manage={manage} /> },
        { key: "locations", label: "rc.locations", content: () => <CrudSection config={locations} /> },
        { key: "rounds", label: "rc.rounds", content: () => <CrudSection config={rounds} /> },
        { key: "questions", label: "rc.questions", content: () => <CrudSection config={questions} /> },
        { key: "checklists", label: "rc.checklists", content: () => <CrudSection config={checklistCfg} /> },
        { key: "items", label: "rc.itemsTab", content: () => <CrudSection config={items} /> },
        { key: "templates", label: "rc.templates", content: () => <CrudSection config={templates} /> },
        { key: "portal", label: "rc.portal", content: () => <Portal manage={manage} /> },
      ]}
    />
  )
}

/** Job types, job categories, candidate sources, interview types: /recruitment/{slug}. */
function CatalogTab({ manage }: { manage: boolean }) {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const kind = CATALOG_KINDS.find((k) => k === searchParams.get("kind")) ?? CATALOG_KINDS[0]
  const api = REC.catalog(kind)
  const cfg: CrudConfig = {
    id: `rc-${kind}`,
    load: api.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.description", path: "description" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "hr.catalog.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "status", label: "hr.f.status", type: "select", options: (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE" },
    save: api.save,
    remove: api.remove,
    invalidates: true,
    manage,
    toolbar: <PlainSelect label={t("hr.catalogKind")} className="w-52" value={kind} onChange={(v) => update({ kind: v, page: 0, status: "", q: "" })} options={CATALOG_KINDS.map((k) => ({ value: k, label: t(`rc.kind.${k}`) }))} />,
  }
  return <CrudSection config={cfg} />
}

/** Career portal: slug (public address), on / off, display name, headline, tagline. */
function Portal({ manage }: { manage: boolean }) {
  const t = useT()
  const [s, setS] = React.useState<CareerSettings>()
  React.useEffect(() => {
    let cancelled = false
    RecruitmentService.settings()
      .then((x) => !cancelled && setS(x ?? { enabled: false, slug: "", displayName: "" }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [])
  if (!s) return <Skeleton className="h-48 w-full" />
  // REC_051: lowercase letters, digits and single hyphens, 3..50 characters
  const slugOk = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.slug ?? "") && (s.slug ?? "").length >= 3 && (s.slug ?? "").length <= 50
  const valid = slugOk && !!s.displayName?.trim()
  const link = typeof window !== "undefined" && s.slug ? `${window.location.origin}/careers/${s.slug}` : ""
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("rc.portal")}</CardTitle>
        <CardDescription>{t("rc.portal.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field id="cp-slug" label={t("rc.portal.slug")} error={s.slug && !slugOk ? t("rc.v.slug") : undefined}>
          <Input id="cp-slug" disabled={!manage} value={s.slug ?? ""} onChange={(e) => setS({ ...s, slug: e.target.value.toLowerCase() })} />
        </Field>
        <Field id="cp-name" label={t("rc.portal.displayName")}>
          <Input id="cp-name" disabled={!manage} maxLength={150} value={s.displayName ?? ""} onChange={(e) => setS({ ...s, displayName: e.target.value })} />
        </Field>
        <Field id="cp-headline" label={t("rc.portal.headline")}>
          <Input id="cp-headline" disabled={!manage} maxLength={200} value={s.headline ?? ""} onChange={(e) => setS({ ...s, headline: e.target.value })} />
        </Field>
        <Field id="cp-tagline" label={t("rc.portal.tagline")}>
          <Input id="cp-tagline" disabled={!manage} maxLength={500} value={s.tagline ?? ""} onChange={(e) => setS({ ...s, tagline: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch disabled={!manage} checked={!!s.enabled} onCheckedChange={(c) => setS({ ...s, enabled: c })} aria-label={t("rc.portal.enabled")} /> {t("rc.portal.enabled")}
        </label>
        {link && s.enabled && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="self-center text-sm underline">
            {link}
          </a>
        )}
        {manage && (
          <div className="sm:col-span-2">
            <Button
              disabled={!valid}
              onClick={async () => {
                let saved: CareerSettings | undefined
                if (await attempt(async () => (saved = await RecruitmentService.saveSettings({ slug: s.slug ?? "", enabled: !!s.enabled, displayName: s.displayName?.trim() ?? "", headline: s.headline?.trim() || undefined, tagline: s.tagline?.trim() || undefined })), t("common.saved")) && saved)
                  setS(saved)
              }}
            >
              {t("common.save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
