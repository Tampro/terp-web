import type { TranslationKey } from "@/lib/i18n"

import type { SectionKey } from "./site.service"

// Proposal: the JSON shape of every landing section (the backend stores any JSON object ≤64 KB, see site.service.ts).
// One description drives both the editor form and the public renderer, so a field added here shows in both.

export type SiteFieldType = "text" | "textarea" | "color" | "image" | "url" | "switch" | "number"
export interface SiteField {
  name: string
  label: TranslationKey
  type?: SiteFieldType
  max?: number
}
export interface SiteList {
  name: string
  label: TranslationKey
  fields: SiteField[]
  maxItems: number
}
export interface SectionSchema {
  fields: SiteField[]
  lists?: SiteList[]
}

const title: SiteField = { name: "title", label: "site.f.title", max: 200 }
const subtitle: SiteField = { name: "subtitle", label: "site.f.subtitle", type: "textarea", max: 500 }
const description: SiteField = { name: "description", label: "site.f.description", type: "textarea", max: 1000 }
const image: SiteField = { name: "image", label: "site.f.image", type: "image", max: 1000 }

export const SECTION_SCHEMAS: Record<Exclude<SectionKey, "order">, SectionSchema> = {
  general: {
    fields: [
      { name: "companyName", label: "site.f.companyName", max: 150 },
      { name: "email", label: "site.f.email", max: 255 },
      { name: "phone", label: "site.f.phone", max: 30 },
      { name: "address", label: "site.f.address", max: 300 },
      { name: "primaryColor", label: "site.f.primaryColor", type: "color" },
      { name: "secondaryColor", label: "site.f.secondaryColor", type: "color" },
      { name: "accentColor", label: "site.f.accentColor", type: "color" },
    ],
  },
  advanced: {
    fields: [
      { name: "customCss", label: "site.f.customCss", type: "textarea", max: 20000 },
      { name: "customJs", label: "site.f.customJs", type: "textarea", max: 20000 },
    ],
  },
  header: {
    fields: [
      { name: "ctaText", label: "site.f.ctaText", max: 50 },
      { name: "ctaUrl", label: "site.f.ctaUrl", type: "url", max: 500 },
      { name: "showPricing", label: "site.f.showPricing", type: "switch" },
    ],
    lists: [{ name: "menu", label: "site.l.menu", maxItems: 10, fields: [{ name: "label", label: "site.f.label", max: 50 }, { name: "url", label: "site.f.url", type: "url", max: 500 }, { name: "newTab", label: "site.f.newTab", type: "switch" }] }],
  },
  hero: {
    fields: [
      title,
      subtitle,
      { name: "primaryText", label: "site.f.primaryText", max: 50 },
      { name: "primaryUrl", label: "site.f.primaryUrl", type: "url", max: 500 },
      { name: "secondaryText", label: "site.f.secondaryText", max: 50 },
      { name: "secondaryUrl", label: "site.f.secondaryUrl", type: "url", max: 500 },
      image,
    ],
  },
  footer: {
    fields: [description, { name: "showNewsletter", label: "site.f.showNewsletter", type: "switch" }, { name: "copyright", label: "site.f.copyright", max: 200 }],
    lists: [{ name: "links", label: "site.l.links", maxItems: 20, fields: [{ name: "label", label: "site.f.label", max: 50 }, { name: "url", label: "site.f.url", type: "url", max: 500 }] }],
  },
  features: {
    fields: [title, subtitle],
    lists: [{ name: "items", label: "site.l.features", maxItems: 12, fields: [{ name: "title", label: "site.f.title", max: 100 }, { name: "description", label: "site.f.description", type: "textarea", max: 500 }, { name: "icon", label: "site.f.icon", max: 4 }] }],
  },
  screenshots: {
    fields: [title, subtitle],
    lists: [{ name: "images", label: "site.l.images", maxItems: 12, fields: [{ name: "url", label: "site.f.image", type: "image", max: 1000 }, { name: "caption", label: "site.f.caption", max: 150 }] }],
  },
  whyUs: {
    fields: [title, subtitle],
    lists: [{ name: "items", label: "site.l.benefits", maxItems: 12, fields: [{ name: "title", label: "site.f.title", max: 100 }, { name: "description", label: "site.f.description", type: "textarea", max: 500 }] }],
  },
  about: {
    fields: [title, { name: "content", label: "site.f.content", type: "textarea", max: 5000 }, image],
    lists: [{ name: "stats", label: "site.l.stats", maxItems: 6, fields: [{ name: "label", label: "site.f.label", max: 50 }, { name: "value", label: "site.f.value", max: 20 }] }],
  },
  team: {
    fields: [title, subtitle],
    lists: [{ name: "members", label: "site.l.members", maxItems: 20, fields: [{ name: "name", label: "site.f.name", max: 100 }, { name: "role", label: "site.f.role", max: 100 }, { name: "image", label: "site.f.image", type: "image", max: 1000 }] }],
  },
  reviews: {
    fields: [title, subtitle],
    lists: [{ name: "items", label: "site.l.reviews", maxItems: 20, fields: [{ name: "name", label: "site.f.name", max: 100 }, { name: "role", label: "site.f.role", max: 100 }, { name: "quote", label: "site.f.quote", type: "textarea", max: 1000 }, { name: "rating", label: "site.f.rating", type: "number", max: 5 }] }],
  },
  plans: {
    fields: [title, subtitle, { name: "yearlyDefault", label: "site.f.yearlyDefault", type: "switch" }, { name: "emptyMessage", label: "site.f.emptyMessage", max: 200 }],
  },
  faq: {
    fields: [title, subtitle],
    lists: [{ name: "items", label: "site.l.faq", maxItems: 30, fields: [{ name: "question", label: "site.f.question", max: 300 }, { name: "answer", label: "site.f.answer", type: "textarea", max: 2000 }] }],
  },
  newsletter: {
    fields: [title, subtitle, { name: "buttonText", label: "site.f.buttonText", max: 50 }],
  },
  contact: {
    fields: [title, subtitle, { name: "email", label: "site.f.email", max: 255 }, { name: "phone", label: "site.f.phone", max: 30 }, { name: "address", label: "site.f.address", max: 300 }],
  },
}

/** a link the page may follow: http(s), mailto, tel, an in-site path or an anchor; anything else (javascript:) is dropped */
export function safeHref(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : ""
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(s) ? s : undefined
}
/** an image source: http(s) or an in-site path */
export function safeSrc(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : ""
  return /^(https?:\/\/|\/(?!\/))/i.test(s) ? s : undefined
}
export const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))
export const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [])
