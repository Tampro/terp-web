"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FIELD_TYPES, SUP, SupportService, type PortalSettings } from "@/lib/support/support.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, fieldErrors, FormFields, TabbedPage, useAuthStore, type CrudConfig, type FieldDef, type Values } from "../../hrm/_components/crud-kit"

const hex = /^#[0-9A-Fa-f]{6}$/
const url = /^https?:\/\/\S{1,490}$/
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const
const TITLES = ["createTicket", "searchTicket", "knowledgeBase", "faq", "contact"] as const
const CTAS = ["knowledgeBase", "faq"] as const
const LINKS = 4
const split = (v: unknown) =>
  String(v ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

export default function SupportSetupPage() {
  return (
    <React.Suspense>
      <Setup />
    </React.Suspense>
  )
}

/** §18 configuration: support portal (branding, section titles, quick links, business hours, contact details), custom pages, ticket categories, ticket custom fields. */
function Setup() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("SUPPORT_SETTINGS_MANAGE")
  const categories: CrudConfig = {
    id: "ticket-categories",
    load: () => SupportService.categories(),
    columns: [
      { label: "hr.f.color", path: "color", kind: "color" },
      { label: "hr.f.name", path: "name" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.category.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 255 },
      { name: "color", label: "hr.f.color", type: "color", required: true, pattern: hex },
    ],
    save: SUP.categories.save,
    remove: SUP.categories.remove,
    invalidates: true,
    manage,
  }
  const fields: CrudConfig = {
    id: "ticket-fields",
    load: () => SupportService.fields() as never,
    columns: [
      { label: "sp.order", path: "order" },
      { label: "sp.label", path: "label" },
      { label: "le.type", render: (r) => t(`sp.ftype.${String(r.type)}` as TranslationKey) },
      { label: "rc.options", render: (r) => ((r.options as string[] | undefined) ?? []).join(", ") || "-" },
      { label: "hr.f.required", path: "required", kind: "bool" },
      { label: "hr.f.active", path: "active", kind: "bool" },
    ],
    rowName: (r) => String(r.label ?? ""),
    createLabel: "sp.field.create",
    fields: [
      { name: "label", label: "sp.label", required: true, max: 255 },
      { name: "type", label: "le.type", type: "select", required: true, options: FIELD_TYPES.map((x) => ({ value: x, label: t(`sp.ftype.${x}`) })) },
      { name: "placeholder", label: "sp.placeholder", max: 255 },
      { name: "width", label: "sp.width", type: "select", required: true, numeric: true, options: [6, 12].map((w) => ({ value: String(w), label: t(w === 12 ? "sp.width.full" : "sp.width.half") })) },
      { name: "order", label: "sp.order", type: "number", min: 0, max: 10000 },
      { name: "required", label: "hr.f.required", type: "switch" },
      { name: "active", label: "hr.f.active", type: "switch" },
      { name: "options", label: "rc.optionsHint", type: "textarea", full: true, hidden: (v) => v.type !== "SELECT", check: (v) => (v.type === "SELECT" && split(v.options).length < 1 ? "sp.v.options" : undefined) },
    ],
    defaults: { type: "TEXT", width: "12", active: true, order: "0" },
    toValues: (r) => ({ ...r, options: ((r.options as string[] | undefined) ?? []).join("\n") }),
    save: (id, b) => SUP.fields.save(id, { ...b, options: b.type === "SELECT" ? split(b.options) : [] }),
    remove: SUP.fields.remove,
    invalidates: true,
    manage,
  }
  const pages: CrudConfig = {
    id: "pages",
    load: () => SUP.pages.list(),
    columns: [
      { label: "hr.f.title", path: "title" },
      { label: "sp.slug", path: "slug", kind: "mono" },
      { label: "hr.f.description", path: "description" },
      { label: "sp.inFooter", path: "showInFooter", kind: "bool" },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "sp.page.create",
    fields: [
      { name: "title", label: "hr.f.title", required: true, max: 255 },
      { name: "slug", label: "sp.slugOptional", max: 100, pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, patternMsg: "sp.v.slug" },
      { name: "description", label: "hr.f.description", max: 500, full: true },
      { name: "showInFooter", label: "sp.inFooter", type: "switch" },
      { name: "contents", label: "sp.contents", type: "textarea", required: true, max: 200000 },
    ],
    fetchRow: async (r) => {
      const d = await SUP.pages.get(r.id ?? "")
      return { ...(d.page as object), contents: d.contents }
    },
    save: SUP.pages.save,
    remove: SUP.pages.remove,
    manage,
  }
  return (
    <TabbedPage
      title={t("menu.sp.setup")}
      description={t("sp.setup.subtitle")}
      tabs={[
        { key: "portal", label: "sp.portal", content: () => <PortalForm manage={manage} /> },
        { key: "pages", label: "sp.pages", content: () => <CrudSection config={pages} /> },
        { key: "categories", label: "sp.ticketCategories", content: () => <CrudSection config={categories} /> },
        { key: "fields", label: "sp.ticketFields", content: () => <CrudSection config={fields} /> },
      ]}
    />
  )
}

function toValues(s: PortalSettings): Values {
  const c = s.content ?? {}
  const v: Values = {
    slug: s.slug ?? "",
    enabled: !!s.enabled,
    brandName: s.brandName ?? "",
    logoUrl: s.logoUrl ?? "",
    faviconUrl: s.faviconUrl ?? "",
    responseTime: c.supportInformation?.responseTime ?? "",
    openingHours: c.supportInformation?.openingHours ?? "",
    closingHours: c.supportInformation?.closingHours ?? "",
    phoneSupport: c.supportInformation?.phoneSupport ?? "",
    address: c.contactInformation?.address ?? "",
    phone: c.contactInformation?.phone ?? "",
    email: c.contactInformation?.email ?? "",
    mapEmbedUrl: c.contactInformation?.mapEmbedUrl ?? "",
  }
  for (const k of TITLES) {
    v[`t_${k}_title`] = c.titleSections?.[k]?.title ?? ""
    v[`t_${k}_desc`] = c.titleSections?.[k]?.description ?? ""
  }
  for (const k of CTAS) {
    v[`c_${k}_title`] = c.ctaSections?.[k]?.title ?? ""
    v[`c_${k}_desc`] = c.ctaSections?.[k]?.description ?? ""
  }
  for (const d of DAYS) v[`day_${d}`] = c.supportInformation?.businessHours?.find((b) => b.day === d)?.open ?? !["SATURDAY", "SUNDAY"].includes(d)
  for (let i = 0; i < LINKS; i++) {
    const l = c.quickLinks?.[i]
    v[`l${i}_title`] = l?.title ?? ""
    v[`l${i}_icon`] = l?.icon ?? ""
    v[`l${i}_link`] = l?.link ?? ""
  }
  return v
}

const str = (v: Values, k: string) => String(v[k] ?? "").trim() || undefined

/** Portal settings: one PUT with the whole content (full replacement). */
function PortalForm({ manage }: { manage: boolean }) {
  const t = useT()
  const [values, setValues] = React.useState<Values>()
  React.useEffect(() => {
    let cancelled = false
    SupportService.settings()
      .then((s) => !cancelled && setValues(toValues(s ?? { enabled: false })))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [])
  if (!values) return <Skeleton className="h-64 w-full" />
  const sections: { title: TranslationKey; hint?: TranslationKey; fields: FieldDef[] }[] = [
    {
      title: "sp.portal.branding",
      fields: [
        { name: "slug", label: "rc.portal.slug", required: true, max: 50, pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, patternMsg: "rc.v.slug", check: (v) => (String(v.slug).length < 3 ? "rc.v.slug" : undefined) },
        { name: "brandName", label: "sp.brandName", required: true, max: 150 },
        { name: "logoUrl", label: "sp.logoUrl", pattern: url, patternMsg: "tr.v.url" },
        { name: "faviconUrl", label: "sp.faviconUrl", pattern: url, patternMsg: "tr.v.url" },
        { name: "enabled", label: "rc.portal.enabled", type: "switch" },
      ],
    },
    {
      title: "sp.portal.titles",
      fields: TITLES.flatMap((k): FieldDef[] => [
        { name: `t_${k}_title`, label: `sp.section.${k}` as TranslationKey, max: 255 },
        { name: `t_${k}_desc`, label: "sp.sectionDesc", max: 2000 },
      ]),
    },
    {
      title: "sp.portal.cta",
      fields: CTAS.flatMap((k): FieldDef[] => [
        { name: `c_${k}_title`, label: `sp.section.${k}` as TranslationKey, max: 255 },
        { name: `c_${k}_desc`, label: "sp.sectionDesc", max: 2000 },
      ]),
    },
    {
      title: "sp.portal.support",
      fields: [
        { name: "responseTime", label: "sp.responseTime", max: 255 },
        { name: "phoneSupport", label: "sp.phoneSupport", max: 255 },
        { name: "openingHours", label: "sp.openingHours", type: "time", max: 20 },
        { name: "closingHours", label: "sp.closingHours", type: "time", max: 20 },
        ...DAYS.map((d): FieldDef => ({ name: `day_${d}`, label: `hr.weekday.${d}` as TranslationKey, type: "switch" })),
      ],
    },
    {
      title: "sp.portal.contact",
      fields: [
        { name: "address", label: "hr.f.address", max: 500, full: true },
        { name: "phone", label: "hr.f.phone", max: 255 },
        { name: "email", label: "hr.f.email", type: "email", max: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
        { name: "mapEmbedUrl", label: "sp.mapUrl", pattern: url, patternMsg: "tr.v.url", full: true },
      ],
    },
    {
      title: "sp.portal.links",
      hint: "sp.portal.linksHint",
      fields: Array.from({ length: LINKS }, (_, i): FieldDef[] => [
        { name: `l${i}_title`, label: "sp.linkTitle", max: 255 },
        { name: `l${i}_link`, label: "sp.linkUrl", pattern: url, patternMsg: "tr.v.url", check: (v) => (str(v, `l${i}_title`) && !str(v, `l${i}_link`) ? "rc.v.url" : undefined) },
      ]).flat(),
    },
  ]
  const all = sections.flatMap((s) => s.fields)
  const errors = fieldErrors(all, values, t)
  const valid = !Object.values(errors).some(Boolean)
  async function save() {
    if (!values) return
    const v = values
    const section = (k: string) => (str(v, `${k}_title`) || str(v, `${k}_desc`) ? { title: str(v, `${k}_title`), description: str(v, `${k}_desc`) } : undefined)
    const body: PortalSettings = {
      slug: String(v.slug).trim(),
      enabled: !!v.enabled,
      brandName: String(v.brandName).trim(),
      logoUrl: str(v, "logoUrl") ?? null,
      faviconUrl: str(v, "faviconUrl") ?? null,
      content: {
        titleSections: Object.fromEntries(TITLES.map((k) => [k, section(`t_${k}`)])) as NonNullable<PortalSettings["content"]>["titleSections"],
        ctaSections: Object.fromEntries(CTAS.map((k) => [k, section(`c_${k}`)])) as NonNullable<PortalSettings["content"]>["ctaSections"],
        supportInformation: {
          responseTime: str(v, "responseTime"),
          openingHours: str(v, "openingHours"),
          closingHours: str(v, "closingHours"),
          phoneSupport: str(v, "phoneSupport"),
          businessHours: DAYS.map((d) => ({ day: d, open: !!v[`day_${d}`] })),
        },
        contactInformation: { address: str(v, "address"), phone: str(v, "phone"), email: str(v, "email"), mapEmbedUrl: str(v, "mapEmbedUrl") },
        quickLinks: Array.from({ length: LINKS }, (_, i) => ({ title: str(v, `l${i}_title`), icon: "link", link: str(v, `l${i}_link`), order: i })).filter((l) => l.title && l.link),
      },
    }
    let saved: PortalSettings | undefined
    if (await attempt(async () => (saved = await SupportService.saveSettings(body)), t("common.saved")) && saved) setValues(toValues(saved))
  }
  const link = typeof window !== "undefined" && values.slug ? `${window.location.origin}/help/${String(values.slug)}` : ""
  return (
    <div className="grid gap-4">
      <fieldset disabled={!manage} className="contents">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="text-base">{t(s.title)}</CardTitle>
              {s.hint && <CardDescription>{t(s.hint)}</CardDescription>}
            </CardHeader>
            <CardContent>
              <FormFields fields={s.fields} values={values} onChange={setValues} errors={errors} prefix="portal" />
            </CardContent>
          </Card>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        {manage && (
          <Button disabled={!valid} onClick={save}>
            {t("common.save")}
          </Button>
        )}
        {!!values.enabled && link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm underline">
            {link}
          </a>
        )}
      </div>
    </div>
  )
}
