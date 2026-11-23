"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Mail, MapPin, Phone, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { ApiError } from "@/lib/api"
import { useT } from "@/lib/i18n"
import type { PlanDto } from "@/lib/saas/saas.service"
import { list, safeHref, safeSrc, str } from "@/lib/site/site.sections"
import { SiteService, type Landing, type SectionContent } from "@/lib/site/site.service"

type S = SectionContent
interface Props {
  sections: Landing
  /** displayed blocks in order */
  order: string[]
  plans: PlanDto[]
  pages: { title?: string; slug?: string }[]
  /** false in the editor preview: forms do not submit and links do not navigate */
  live?: boolean
}

/**
 * The public landing page (manual §3.4), drawn from the saved section JSON (shapes: lib/site/site.sections.ts). Every
 * text is shown as text; links and images only from safe schemes. Used by /site and by the editor's live preview.
 */
export function LandingView({ sections, order, plans, pages, live = true }: Props) {
  const general = sections.general ?? {}
  const style = {
    "--site-primary": str(general.primaryColor) || "#2563eb",
    "--site-secondary": str(general.secondaryColor) || "#0f172a",
    "--site-accent": str(general.accentColor) || "#f59e0b",
  } as React.CSSProperties
  const guard = (e: React.MouseEvent) => {
    if (!live && (e.target as HTMLElement).closest("a")) e.preventDefault()
  }
  return (
    <div style={style} className="bg-white text-slate-800" onClickCapture={guard}>
      {order.map((key) => {
        const s = sections[key as keyof Landing] ?? {}
        // content blocks never filled in are left out instead of drawing an empty band
        if (OPTIONAL.includes(key) && !filled(s)) return null
        switch (key) {
          case "header":
            return <Header key={key} s={s} general={general} pages={pages} showPricing={order.includes("plans")} />
          case "hero":
            return <Hero key={key} s={s} />
          case "features":
            return <Cards key={key} id="features" s={s} items={list(s.items)} icon />
          case "whyUs":
            return <Cards key={key} id="why-us" s={s} items={list(s.items)} tinted />
          case "screenshots":
            return <Gallery key={key} s={s} />
          case "about":
            return <About key={key} s={s} />
          case "team":
            return <Team key={key} s={s} />
          case "reviews":
            return <Reviews key={key} s={s} />
          case "plans":
            return <Plans key={key} s={s} plans={plans} />
          case "faq":
            return <Faq key={key} s={s} />
          case "newsletter":
            return <Newsletter key={key} s={s} live={live} />
          case "contact":
            return <Contact key={key} s={s} live={live} />
          case "footer":
            return <Footer key={key} s={s} general={general} pages={pages} live={live} showNewsletter={s.showNewsletter === true && !order.includes("newsletter")} />
          default:
            return null
        }
      })}
    </div>
  )
}

const OPTIONAL = ["features", "whyUs", "screenshots", "about", "team", "reviews", "faq"]
const filled = (v: unknown): boolean =>
  typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.some(filled) : v && typeof v === "object" ? Object.values(v).some(filled) : false
/** form controls keep light colours whatever the admin theme is (the public page is always light) */
const LIGHT = "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:bg-white dark:text-slate-900"

function Heading({ s, fallback }: { s: S; fallback?: string }) {
  const t = str(s.title) || fallback
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {t && <h2 className="text-3xl font-bold text-[var(--site-secondary)]">{t}</h2>}
      {str(s.subtitle) && <p className="mt-3 text-slate-600">{str(s.subtitle)}</p>}
    </div>
  )
}
const Section = ({ id, children, tinted }: { id: string; children: React.ReactNode; tinted?: boolean }) => (
  <section id={id} className={`px-4 py-16 sm:px-8 ${tinted ? "bg-slate-50" : ""}`}>
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
)
function A({ href, children, className, newTab }: { href: unknown; children: React.ReactNode; className?: string; newTab?: boolean }) {
  const h = safeHref(href)
  if (!h) return <span className={className}>{children}</span>
  return (
    <a href={h} className={className} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  )
}

function Header({ s, general, pages, showPricing }: { s: S; general: S; pages: Props["pages"]; showPricing: boolean }) {
  const t = useT()
  const menu = list(s.menu)
  return (
    <header className="sticky top-0 z-10 border-b bg-white/95 px-4 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 py-3">
        <span className="text-lg font-bold text-[var(--site-primary)]">{str(general.companyName) || "ERP"}</span>
        <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          {menu.map((m, i) => (
            <A key={i} href={m.url} newTab={m.newTab === true} className="hover:text-[var(--site-primary)]">
              {str(m.label)}
            </A>
          ))}
          {s.showPricing !== false && showPricing && (
            <a href="#pricing" className="hover:text-[var(--site-primary)]">
              {t("site.v.pricing")}
            </a>
          )}
          {pages.slice(0, 5).map((p) => (
            <Link key={p.slug} href={`/site/${p.slug}`} className="hover:text-[var(--site-primary)]">
              {p.title}
            </Link>
          ))}
        </nav>
        {str(s.ctaText) && (
          <A href={s.ctaUrl || "/register"} className="rounded-md bg-[var(--site-primary)] px-4 py-2 text-sm font-medium text-white">
            {str(s.ctaText)}
          </A>
        )}
      </div>
    </header>
  )
}

function Hero({ s }: { s: S }) {
  const img = safeSrc(s.image)
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white px-4 py-20 sm:px-8">
      <div className={`mx-auto grid max-w-6xl items-center gap-10 ${img ? "md:grid-cols-2" : ""}`}>
        <div className={img ? "" : "mx-auto max-w-3xl text-center"}>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--site-secondary)] sm:text-5xl">{str(s.title) || "—"}</h1>
          {str(s.subtitle) && <p className="mt-5 text-lg text-slate-600">{str(s.subtitle)}</p>}
          <div className={`mt-8 flex flex-wrap gap-3 ${img ? "" : "justify-center"}`}>
            {str(s.primaryText) && (
              <A href={s.primaryUrl} className="rounded-md bg-[var(--site-primary)] px-5 py-3 font-medium text-white">
                {str(s.primaryText)}
              </A>
            )}
            {str(s.secondaryText) && (
              <A href={s.secondaryUrl} className="rounded-md border border-[var(--site-primary)] px-5 py-3 font-medium text-[var(--site-primary)]">
                {str(s.secondaryText)}
              </A>
            )}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- media URLs of any host */}
        {img && <img src={img} alt="" className="w-full rounded-xl shadow-lg" />}
      </div>
    </section>
  )
}

function Cards({ id, s, items, icon, tinted }: { id: string; s: S; items: S[]; icon?: boolean; tinted?: boolean }) {
  return (
    <Section id={id} tinted={tinted}>
      <Heading s={s} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border bg-white p-6">
            {icon && str(it.icon) && <div className="mb-3 text-3xl">{str(it.icon)}</div>}
            {!icon && <Check className="mb-3 size-6 text-[var(--site-accent)]" />}
            <h3 className="font-semibold">{str(it.title)}</h3>
            <p className="mt-2 text-sm whitespace-pre-line text-slate-600">{str(it.description)}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Gallery({ s }: { s: S }) {
  return (
    <Section id="screenshots">
      <Heading s={s} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list(s.images).map((g, i) => {
          const src = safeSrc(g.url)
          return (
            <figure key={i} className="overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element -- media URLs of any host */}
              {src ? <img src={src} alt={str(g.caption)} className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-slate-100" />}
              {str(g.caption) && <figcaption className="p-3 text-sm text-slate-600">{str(g.caption)}</figcaption>}
            </figure>
          )
        })}
      </div>
    </Section>
  )
}

function About({ s }: { s: S }) {
  const img = safeSrc(s.image)
  const stats = list(s.stats)
  return (
    <Section id="about" tinted>
      <div className={`grid items-center gap-10 ${img ? "md:grid-cols-2" : ""}`}>
        <div>
          {str(s.title) && <h2 className="text-3xl font-bold text-[var(--site-secondary)]">{str(s.title)}</h2>}
          <p className="mt-4 whitespace-pre-line text-slate-600">{str(s.content)}</p>
          {stats.length > 0 && (
            <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
              {stats.map((st, i) => (
                <div key={i}>
                  <dd className="text-3xl font-bold text-[var(--site-primary)]">{str(st.value)}</dd>
                  <dt className="text-sm text-slate-600">{str(st.label)}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- media URLs of any host */}
        {img && <img src={img} alt="" className="w-full rounded-xl" />}
      </div>
    </Section>
  )
}

function Team({ s }: { s: S }) {
  return (
    <Section id="team">
      <Heading s={s} />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {list(s.members).map((m, i) => {
          const src = safeSrc(m.image)
          return (
            <div key={i} className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- media URLs of any host */}
              {src ? <img src={src} alt={str(m.name)} className="mx-auto size-24 rounded-full object-cover" /> : <div className="mx-auto size-24 rounded-full bg-slate-200" />}
              <div className="mt-3 font-semibold">{str(m.name)}</div>
              <div className="text-sm text-slate-600">{str(m.role)}</div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function Reviews({ s }: { s: S }) {
  return (
    <Section id="reviews" tinted>
      <Heading s={s} />
      <div className="grid gap-6 md:grid-cols-3">
        {list(s.items).map((r, i) => {
          const rating = Math.max(0, Math.min(5, Number(r.rating) || 0))
          return (
            <blockquote key={i} className="rounded-xl border bg-white p-6">
              {rating > 0 && (
                <div className="mb-3 flex gap-0.5" aria-label={`${rating}/5`}>
                  {Array.from({ length: rating }, (_, k) => (
                    <Star key={k} className="size-4 fill-[var(--site-accent)] text-[var(--site-accent)]" />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-line text-slate-700">{str(r.quote)}</p>
              <footer className="mt-4 text-sm">
                <span className="font-semibold">{str(r.name)}</span>
                {str(r.role) && <span className="text-slate-500"> · {str(r.role)}</span>}
              </footer>
            </blockquote>
          )
        })}
      </div>
    </Section>
  )
}

function Plans({ s, plans }: { s: S; plans: PlanDto[] }) {
  const t = useT()
  const money = useMoney()
  const [yearly, setYearly] = React.useState(s.yearlyDefault === true)
  return (
    <Section id="pricing">
      <Heading s={s} fallback={t("site.v.pricing")} />
      <div className="mb-8 flex justify-center gap-2">
        <Button size="sm" variant={yearly ? "outline" : "default"} onClick={() => setYearly(false)}>
          {t("site.v.monthly")}
        </Button>
        <Button size="sm" variant={yearly ? "default" : "outline"} onClick={() => setYearly(true)}>
          {t("site.v.yearly")}
        </Button>
      </div>
      {plans.length === 0 ? (
        <p className="text-center text-slate-500">{str(s.emptyMessage) || t("site.v.noPlans")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const price = yearly ? p.yearlyPrice : p.monthlyPrice
            return (
              <div key={p.id} className={`rounded-xl border p-6 ${p.recommended ? "border-[var(--site-primary)] shadow-lg" : ""}`} data-testid="site-plan">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
                <div className="mt-4 text-3xl font-bold">{price == null ? "—" : money(price)}</div>
                <div className="text-sm text-slate-500">{t(yearly ? "site.v.perYear" : "site.v.perMonth")}</div>
                <ul className="mt-4 space-y-1 text-sm">
                  <li>{t("site.v.users", { n: p.maxUsers ?? "∞" })}</li>
                  <li>{t("site.v.employees", { n: p.maxEmployees ?? "∞" })}</li>
                  <li>{t("site.v.storage", { n: p.storageLimitGb ?? "∞" })}</li>
                  {!!p.trialDays && <li>{t("site.v.trial", { n: p.trialDays })}</li>}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function Faq({ s }: { s: S }) {
  return (
    <Section id="faq" tinted>
      <Heading s={s} />
      <div className="mx-auto max-w-3xl space-y-3">
        {list(s.items).map((f, i) => (
          <details key={i} className="rounded-lg border bg-white p-4">
            <summary className="cursor-pointer font-medium">{str(f.question)}</summary>
            <p className="mt-2 whitespace-pre-line text-slate-600">{str(f.answer)}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message || fallback : fallback)

function NewsletterForm({ live, button }: { live: boolean; button: string }) {
  const t = useT()
  const [email, setEmail] = React.useState("")
  const [state, setState] = React.useState<{ ok?: boolean; msg?: string; busy?: boolean }>({})
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!live) return
    setState({ busy: true })
    try {
      await SiteService.subscribe(email.trim())
      setEmail("")
      setState({ ok: true, msg: t("site.v.subscribed") })
    } catch (err) {
      setState({ ok: false, msg: errorText(err, t("site.v.failed")) })
    }
  }
  return (
    <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-2">
      <div className="flex gap-2">
        <Input type="email" required maxLength={255} aria-label={t("site.f.email")} placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={LIGHT} />
        <Button type="submit" disabled={state.busy}>
          {button || t("site.v.subscribe")}
        </Button>
      </div>
      {state.msg && (
        <p role="status" className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.msg}
        </p>
      )}
    </form>
  )
}

function Newsletter({ s, live }: { s: S; live: boolean }) {
  const t = useT()
  return (
    <section id="newsletter" className="bg-[var(--site-secondary)] px-4 py-16 text-white sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold">{str(s.title) || t("site.v.newsletter")}</h2>
        {str(s.subtitle) && <p className="mt-2 mb-6 text-white/80">{str(s.subtitle)}</p>}
        <NewsletterForm live={live} button={str(s.buttonText)} />
      </div>
    </section>
  )
}

function Contact({ s, live }: { s: S; live: boolean }) {
  const t = useT()
  const empty = { name: "", email: "", phone: "", subject: "", message: "" }
  const [f, setF] = React.useState(empty)
  const [state, setState] = React.useState<{ ok?: boolean; msg?: string; busy?: boolean }>({})
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!live) return
    setState({ busy: true })
    try {
      await SiteService.contact({ ...f, phone: f.phone || undefined })
      setF(empty)
      setState({ ok: true, msg: t("site.v.sent") })
    } catch (err) {
      setState({ ok: false, msg: errorText(err, t("site.v.failed")) })
    }
  }
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Section id="contact">
      <Heading s={s} fallback={t("site.v.contact")} />
      <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
        <ul className="space-y-3 text-sm">
          {str(s.email) && (
            <li className="flex gap-2">
              <Mail className="size-4" /> {str(s.email)}
            </li>
          )}
          {str(s.phone) && (
            <li className="flex gap-2">
              <Phone className="size-4" /> {str(s.phone)}
            </li>
          )}
          {str(s.address) && (
            <li className="flex gap-2">
              <MapPin className="size-4" /> {str(s.address)}
            </li>
          )}
        </ul>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Input required maxLength={150} aria-label={t("site.f.name")} placeholder={t("site.f.name")} value={f.name} onChange={set("name")} className={LIGHT} />
          <Input required type="email" maxLength={255} aria-label={t("site.f.email")} placeholder={t("site.f.email")} value={f.email} onChange={set("email")} className={LIGHT} />
          <Input maxLength={30} aria-label={t("site.f.phone")} placeholder={t("site.f.phone")} value={f.phone} onChange={set("phone")} className={LIGHT} />
          <Input required maxLength={255} aria-label={t("site.f.subject")} placeholder={t("site.f.subject")} value={f.subject} onChange={set("subject")} className={LIGHT} />
          <Textarea required maxLength={5000} rows={5} aria-label={t("site.f.message")} placeholder={t("site.f.message")} value={f.message} onChange={set("message")} className={`sm:col-span-2 ${LIGHT}`} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={state.busy}>
              {t("site.v.send")}
            </Button>
            {state.msg && (
              <p role="status" className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
                {state.msg}
              </p>
            )}
          </div>
        </form>
      </div>
    </Section>
  )
}

function Footer({ s, general, pages, live, showNewsletter }: { s: S; general: S; pages: Props["pages"]; live: boolean; showNewsletter: boolean }) {
  return (
    <footer className="bg-slate-900 px-4 py-12 text-slate-300 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        <div>
          <div className="text-lg font-bold text-white">{str(general.companyName) || "ERP"}</div>
          {str(s.description) && <p className="mt-2 text-sm whitespace-pre-line">{str(s.description)}</p>}
          <div className="mt-3 space-y-1 text-sm">
            {str(general.email) && <div>{str(general.email)}</div>}
            {str(general.phone) && <div>{str(general.phone)}</div>}
            {str(general.address) && <div>{str(general.address)}</div>}
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {list(s.links).map((l, i) => (
            <li key={i}>
              <A href={l.url} className="hover:text-white">
                {str(l.label)}
              </A>
            </li>
          ))}
          {pages.map((p) => (
            <li key={p.slug}>
              <Link href={`/site/${p.slug}`} className="hover:text-white">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
        {showNewsletter && <NewsletterForm live={live} button="" />}
      </div>
      {str(s.copyright) && <div className="mx-auto mt-8 max-w-6xl border-t border-slate-700 pt-4 text-center text-xs">{str(s.copyright)}</div>}
    </footer>
  )
}
