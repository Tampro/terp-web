"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { BookOpen, CheckCircle2, Clock, HelpCircle, LifeBuoy, Mail, MapPin, Phone, Search, Ticket } from "lucide-react"

import { FieldError } from "@/components/auth/password-input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { htmlToText, SupportPortal, type PortalInfo, type PublicTicket, type TicketField } from "@/lib/support/support.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

type Tab = "home" | "create" | "track" | "kb" | "faq" | "contact" | `page:${string}`
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * §18 public customer support portal at /help/{slug}, no sign-in: create and track tickets (number + email or the
 * tracking token), reply while not closed (SUP_006), knowledge base, FAQ, contact form, custom pages. Article and page
 * contents are shown as text: the backend sanitizes its HTML, but plain text keeps the portal free of injected markup.
 */
export default function SupportPortalPage() {
  const { slug } = useParams<{ slug: string }>()
  const t = useT()
  const [info, setInfo] = React.useState<PortalInfo | null>()
  const [error, setError] = React.useState<string>()
  const [tab, setTab] = React.useState<Tab>("home")
  React.useEffect(() => {
    let cancelled = false
    SupportPortal.info(slug)
      .then((x) => !cancelled && setInfo(x))
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        setInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug])
  if (info === undefined) return <Skeleton className="mx-auto my-10 h-64 w-full max-w-4xl" />
  if (info === null)
    return (
      <div className="mx-auto max-w-xl p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  const c = info.content ?? {}
  const title = (k: keyof NonNullable<typeof c.titleSections>, fallback: TranslationKey) => c.titleSections?.[k]?.title || t(fallback)
  const tabs: [Tab, string][] = [
    ["home", t("hp.tab.home")],
    ["create", title("createTicket", "hp.tab.create")],
    ["track", title("searchTicket", "hp.tab.track")],
    ["kb", title("knowledgeBase", "hp.tab.kb")],
    ["faq", title("faq", "hp.tab.faq")],
    ["contact", title("contact", "hp.tab.contact")],
  ]
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-5">
          {info.logoUrl ? (
            // an external logo URL chosen by the company: next/image would need every host whitelisted
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.logoUrl} alt="" className="h-9 w-auto" />
          ) : (
            <LifeBuoy className="size-8" />
          )}
          <h1 className="text-2xl font-semibold">{info.brandName}</h1>
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-1 px-4 pb-3" role="tablist">
          {tabs.map(([k, label]) => (
            <Button key={k} role="tab" aria-selected={tab === k} size="sm" variant={tab === k ? "default" : "ghost"} onClick={() => setTab(k)}>
              {label}
            </Button>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {tab === "home" && <Home info={info} go={setTab} />}
        {tab === "create" && <CreateTicket slug={slug} info={info} onTrack={() => setTab("track")} />}
        {tab === "track" && <TrackTicket slug={slug} />}
        {tab === "kb" && <Knowledge slug={slug} info={info} />}
        {tab === "faq" && <Faq slug={slug} />}
        {tab === "contact" && <Contact slug={slug} info={info} />}
        {tab.startsWith("page:") && <CustomPage slug={slug} pageSlug={tab.slice(5)} />}
      </main>
      <footer className="bg-background border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-4 text-sm">
          {(info.pages ?? [])
            .filter((p) => p.showInFooter)
            .map((p) => (
              <button key={p.id} type="button" className="underline-offset-4 hover:underline" onClick={() => setTab(`page:${p.slug}`)}>
                {p.title}
              </button>
            ))}
          {(c.quickLinks ?? []).map((l) => (
            <a key={l.link} href={l.link} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              {l.title}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}

function Home({ info, go }: { info: PortalInfo; go: (t: Tab) => void }) {
  const t = useT()
  const c = info.content ?? {}
  const s = c.supportInformation
  const card = (tab: Tab, icon: React.ReactNode, titleText: string, desc?: string) => (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => go(tab)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {titleText}
        </CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
    </Card>
  )
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {card("create", <Ticket className="size-5" />, c.titleSections?.createTicket?.title || t("hp.tab.create"), c.titleSections?.createTicket?.description)}
        {card("track", <Search className="size-5" />, c.titleSections?.searchTicket?.title || t("hp.tab.track"), c.titleSections?.searchTicket?.description)}
        {card("kb", <BookOpen className="size-5" />, c.ctaSections?.knowledgeBase?.title || t("hp.tab.kb"), c.ctaSections?.knowledgeBase?.description)}
        {card("faq", <HelpCircle className="size-5" />, c.ctaSections?.faq?.title || t("hp.tab.faq"), c.ctaSections?.faq?.description)}
      </div>
      {s && (s.responseTime || s.openingHours || s.phoneSupport) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-5" /> {t("hp.supportInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {s.responseTime && <span>{t("hp.responseTime", { v: s.responseTime })}</span>}
            {s.openingHours && (
              <span>
                {t("hp.hours", { from: s.openingHours, to: s.closingHours ?? "" })}
                {!!s.businessHours?.length && ` · ${s.businessHours.filter((d) => d.open).map((d) => t(`hr.weekday.${d.day}` as TranslationKey)).join(", ")}`}
              </span>
            )}
            {s.phoneSupport && <span>{t("hp.phoneSupport", { v: s.phoneSupport })}</span>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Custom fields of the portal form; values keyed by field id. */
function CustomFields({ fields, values, set, tried }: { fields: TicketField[]; values: Record<string, string>; set: (id: string, v: string) => void; tried: boolean }) {
  const t = useT()
  return (
    <>
      {fields
        .filter((f) => f.active !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((f) => {
          const id = `cf-${f.id}`
          const v = values[f.id ?? ""] ?? ""
          const missing = f.required && !v.trim()
          return (
            <div key={f.id} className={`grid gap-1.5 ${(f.width ?? 12) > 6 ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={id}>
                {f.label}
                {f.required && " *"}
              </Label>
              {f.type === "TEXTAREA" ? (
                <Textarea id={id} rows={3} maxLength={2000} placeholder={f.placeholder ?? undefined} value={v} onChange={(e) => set(f.id ?? "", e.target.value)} />
              ) : f.type === "SELECT" ? (
                <Select value={v || undefined} onValueChange={(x) => set(f.id ?? "", x)}>
                  <SelectTrigger id={id} aria-label={f.label}>
                    <SelectValue placeholder={f.placeholder ?? t("sales.choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id={id} type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : f.type === "EMAIL" ? "email" : "text"} maxLength={2000} placeholder={f.placeholder ?? undefined} value={v} onChange={(e) => set(f.id ?? "", e.target.value)} />
              )}
              {tried && missing && <FieldError message={t("hr.v.required")} />}
            </div>
          )
        })}
    </>
  )
}

function CreateTicket({ slug, info, onTrack }: { slug: string; info: PortalInfo; onTrack: () => void }) {
  const t = useT()
  const [v, setV] = React.useState({ name: "", email: "", categoryId: "", subject: "", description: "" })
  const [cf, setCf] = React.useState<Record<string, string>>({})
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [done, setDone] = React.useState<{ ticketNumber?: string; trackingToken?: string }>()
  const fields = info.ticketFields ?? []
  const missingCf = fields.some((f) => f.active !== false && f.required && !(cf[f.id ?? ""] ?? "").trim())
  const valid = !!v.name.trim() && email.test(v.email) && !!v.categoryId && !!v.subject.trim() && !!v.description.trim() && !missingCf
  if (done)
    return (
      <Card className="max-w-lg">
        <CardContent className="grid gap-2 pt-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <p className="font-medium">{t("hp.created")}</p>
          <p className="font-mono text-lg" data-testid="ticket-number">
            {done.ticketNumber}
          </p>
          <p className="text-muted-foreground text-xs">{t("hp.createdHint")}</p>
          <Button variant="outline" onClick={onTrack}>
            {t("hp.tab.track")}
          </Button>
        </CardContent>
      </Card>
    )
  const set = (k: keyof typeof v, x: string) => setV((s) => ({ ...s, [k]: x }))
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">{info.content?.titleSections?.createTicket?.title || t("hp.tab.create")}</CardTitle>
        {info.content?.titleSections?.createTicket?.description && <CardDescription>{info.content.titleSections.createTicket.description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {(["name", "email"] as const).map((k) => (
          <div key={k} className="grid gap-1.5">
            <Label htmlFor={`tk-${k}`}>{t(k === "name" ? "hr.f.name" : "hr.f.email")} *</Label>
            <Input id={`tk-${k}`} type={k === "email" ? "email" : "text"} maxLength={255} value={v[k]} onChange={(e) => set(k, e.target.value)} />
            {tried && (k === "email" ? !email.test(v.email) : !v.name.trim()) && <FieldError message={t(k === "email" ? "hr.v.email" : "hr.v.required")} />}
          </div>
        ))}
        <div className="grid gap-1.5">
          <Label htmlFor="tk-category">{t("hr.f.category")} *</Label>
          <Select value={v.categoryId || undefined} onValueChange={(x) => set("categoryId", x)}>
            <SelectTrigger id="tk-category" aria-label={t("hr.f.category")}>
              <SelectValue placeholder={t("sales.choose")} />
            </SelectTrigger>
            <SelectContent>
              {(info.ticketCategories ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tried && !v.categoryId && <FieldError message={t("hr.v.required")} />}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tk-subject">{t("sp.subject")} *</Label>
          <Input id="tk-subject" maxLength={255} value={v.subject} onChange={(e) => set("subject", e.target.value)} />
          {tried && !v.subject.trim() && <FieldError message={t("hr.v.required")} />}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="tk-description">{t("hr.f.description")} *</Label>
          <Textarea id="tk-description" rows={5} maxLength={20000} value={v.description} onChange={(e) => set("description", e.target.value)} />
          {tried && !v.description.trim() && <FieldError message={t("hr.v.required")} />}
        </div>
        <CustomFields fields={fields} values={cf} set={(id, x) => setCf((s) => ({ ...s, [id]: x }))} tried={tried} />
        {error && (
          <Alert variant="destructive" className="sm:col-span-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="sm:col-span-2">
          <Button
            disabled={busy}
            onClick={async () => {
              setTried(true)
              if (!valid) return
              setBusy(true)
              setError(undefined)
              try {
                setDone(
                  await SupportPortal.create(slug, {
                    name: v.name.trim(),
                    email: v.email.trim(),
                    categoryId: Number(v.categoryId),
                    subject: v.subject.trim(),
                    description: v.description.trim(),
                    customFields: Object.entries(cf)
                      .filter(([, x]) => x.trim())
                      .map(([fieldId, value]) => ({ fieldId: Number(fieldId), value: value.trim() })),
                  }),
                )
              } catch (e) {
                setError(errText(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {t("hp.submitTicket")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TrackTicket({ slug }: { slug: string }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [q, setQ] = React.useState({ ticketNumber: "", email: "" })
  const [ticket, setTicket] = React.useState<PublicTicket>()
  const [error, setError] = React.useState<string>()
  const [reply, setReply] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const key = { ticketNumber: q.ticketNumber.trim(), email: q.email.trim() }
  return (
    <div className="grid gap-4">
      <Card className="max-w-lg">
        <CardContent className="pt-6">
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(undefined)
              setTicket(undefined)
              try {
                setTicket(await SupportPortal.track(slug, key))
              } catch (err) {
                setError(errText(err))
              }
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="tr-number">{t("hp.ticketNumber")}</Label>
              <Input id="tr-number" value={q.ticketNumber} onChange={(e) => setQ({ ...q, ticketNumber: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tr-email">{t("hr.f.email")}</Label>
              <Input id="tr-email" type="email" value={q.email} onChange={(e) => setQ({ ...q, email: e.target.value })} />
            </div>
            <Button type="submit" disabled={!key.ticketNumber || !email.test(key.email)}>
              {t("cp.trackButton")}
            </Button>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
      {ticket && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span className="font-mono">{ticket.ticketNumber}</span> {ticket.subject} <Badge data-testid="ticket-status">{t(`hr.status.${ticket.status ?? "IN_PROGRESS"}` as TranslationKey)}</Badge>
            </CardTitle>
            <CardDescription>
              {ticket.categoryName} · {formatDate(ticket.createdDate, language)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="whitespace-pre-wrap">{ticket.description}</p>
            {(ticket.replies ?? []).map((r, i) => (
              <div key={i} className={`max-w-[85%] rounded-lg p-3 ${r.senderType === "STAFF" ? "bg-primary/10" : "bg-muted justify-self-end"}`}>
                <p className="text-muted-foreground mb-1 text-xs">
                  {r.senderName} · {formatDate(r.createdDate, language)}
                </p>
                <p className="whitespace-pre-wrap">{r.description}</p>
              </div>
            ))}
            {ticket.status === "CLOSED" ? (
              <p className="text-muted-foreground">{t("sp.closedNoReply")}</p>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="tr-reply">{t("sp.reply")}</Label>
                <Textarea id="tr-reply" rows={3} maxLength={20000} value={reply} onChange={(e) => setReply(e.target.value)} />
                <Button
                  className="w-fit"
                  disabled={!reply.trim() || busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      setTicket(await SupportPortal.reply(slug, { ...key, description: reply.trim() }))
                      setReply("")
                    } catch (e) {
                      setError(errText(e))
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {t("sp.send")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Knowledge({ slug, info }: { slug: string; info: PortalInfo }) {
  const t = useT()
  const [q, setQ] = React.useState({ keyword: "", categoryId: "" })
  const [draft, setDraft] = React.useState("")
  const [list, setList] = React.useState<{ id?: string; title?: string; description?: string; categoryTitle?: string }[]>()
  const [open, setOpen] = React.useState<{ title?: string; content?: string; categoryTitle?: string }>()
  React.useEffect(() => {
    let cancelled = false
    SupportPortal.kb(slug, { keyword: q.keyword || undefined, categoryId: q.categoryId || undefined })
      .then((p) => !cancelled && setList(p.content ?? []))
      .catch(() => !cancelled && setList([]))
    return () => {
      cancelled = true
    }
  }, [slug, q])
  if (open)
    return (
      <Card>
        <CardHeader>
          <Button variant="link" className="w-fit px-0" onClick={() => setOpen(undefined)}>
            ← {t("hp.tab.kb")}
          </Button>
          <CardTitle>{open.title}</CardTitle>
          <CardDescription>{open.categoryTitle}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm whitespace-pre-wrap">{htmlToText(open.content)}</CardContent>
      </Card>
    )
  return (
    <div className="grid gap-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setQ((x) => ({ ...x, keyword: draft.trim() }))
        }}
      >
        <Input className="w-64" aria-label={t("hp.searchKb")} placeholder={t("hp.searchKb")} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" variant="outline" size="icon" aria-label={t("hp.searchKb")}>
          <Search className="size-4" />
        </Button>
        {(info.kbCategories ?? []).map((c) => (
          <Button key={c.id} type="button" size="sm" variant={q.categoryId === c.id ? "default" : "outline"} onClick={() => setQ((x) => ({ ...x, categoryId: x.categoryId === c.id ? "" : String(c.id) }))}>
            {c.title}
          </Button>
        ))}
      </form>
      {!list ? (
        <Skeleton className="h-32 w-full" />
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("hp.noArticles")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:shadow-md"
              onClick={async () => {
                const d = await SupportPortal.article(slug, a.id ?? "").catch(() => undefined)
                if (d) setOpen({ title: d.article?.title, categoryTitle: d.article?.categoryTitle, content: d.content })
              }}
            >
              <CardHeader>
                <CardTitle className="text-base">{a.title}</CardTitle>
                <CardDescription>{a.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


function Faq({ slug }: { slug: string }) {
  const t = useT()
  const [list, setList] = React.useState<{ id?: string; title?: string; description?: string }[]>()
  React.useEffect(() => {
    let cancelled = false
    SupportPortal.faqs(slug)
      .then((p) => !cancelled && setList(p.content ?? []))
      .catch(() => !cancelled && setList([]))
    return () => {
      cancelled = true
    }
  }, [slug])
  if (!list) return <Skeleton className="h-32 w-full" />
  if (!list.length) return <p className="text-muted-foreground text-sm">{t("hp.noFaq")}</p>
  return (
    <Accordion type="single" collapsible className="bg-background rounded-md border px-4">
      {list.map((f) => (
        <AccordionItem key={f.id} value={String(f.id)}>
          <AccordionTrigger>{f.title}</AccordionTrigger>
          <AccordionContent className="whitespace-pre-wrap">{htmlToText(f.description)}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function Contact({ slug, info }: { slug: string; info: PortalInfo }) {
  const t = useT()
  const ci = info.content?.contactInformation
  const [v, setV] = React.useState({ name: "", email: "", subject: "", message: "" })
  const [tried, setTried] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const valid = !!v.name.trim() && email.test(v.email) && !!v.subject.trim() && !!v.message.trim()
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <CardContent className="grid gap-3 pt-6">
          {sent ? (
            <Alert>
              <AlertDescription>{t("hp.contactSent")}</AlertDescription>
            </Alert>
          ) : (
            <>
              {(["name", "email", "subject"] as const).map((k) => (
                <div key={k} className="grid gap-1.5">
                  <Label htmlFor={`ct-${k}`}>{t(k === "name" ? "hr.f.name" : k === "email" ? "hr.f.email" : "sp.subject")} *</Label>
                  <Input id={`ct-${k}`} type={k === "email" ? "email" : "text"} maxLength={255} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
                  {tried && (k === "email" ? !email.test(v.email) : !v[k].trim()) && <FieldError message={t(k === "email" ? "hr.v.email" : "hr.v.required")} />}
                </div>
              ))}
              <div className="grid gap-1.5">
                <Label htmlFor="ct-message">{t("sp.message")} *</Label>
                <Textarea id="ct-message" rows={4} maxLength={5000} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
                {tried && !v.message.trim() && <FieldError message={t("hr.v.required")} />}
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                className="w-fit"
                onClick={async () => {
                  setTried(true)
                  if (!valid) return
                  try {
                    await SupportPortal.contact(slug, { name: v.name.trim(), email: v.email.trim(), subject: v.subject.trim(), message: v.message.trim() })
                    setSent(true)
                  } catch (e) {
                    setError(errText(e))
                  }
                }}
              >
                {t("sp.send")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      {ci && (ci.address || ci.phone || ci.email) && (
        <Card>
          <CardContent className="grid gap-2 pt-6 text-sm">
            {ci.address && (
              <span className="inline-flex gap-2">
                <MapPin className="size-4 shrink-0" /> {ci.address}
              </span>
            )}
            {ci.phone && (
              <span className="inline-flex gap-2">
                <Phone className="size-4" /> {ci.phone}
              </span>
            )}
            {ci.email && (
              <span className="inline-flex gap-2">
                <Mail className="size-4" /> {ci.email}
              </span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CustomPage({ slug, pageSlug }: { slug: string; pageSlug: string }) {
  const [page, setPage] = React.useState<{ title?: string; contents?: string } | null>()
  React.useEffect(() => {
    let cancelled = false
    SupportPortal.page(slug, pageSlug)
      .then((p) => !cancelled && setPage({ title: p.page?.title, contents: p.contents }))
      .catch(() => !cancelled && setPage(null))
    return () => {
      cancelled = true
    }
  }, [slug, pageSlug])
  if (page === undefined) return <Skeleton className="h-32 w-full" />
  if (page === null) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{page.title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm whitespace-pre-wrap">{htmlToText(page.contents)}</CardContent>
    </Card>
  )
}
