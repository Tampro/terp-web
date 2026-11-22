"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Bookmark, BookmarkCheck, Briefcase, CheckCircle2, MapPin, Search } from "lucide-react"

import { FieldError } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { CareerPortal, type JobCard, type JobDetail, type PublicQuestion, type Site } from "@/lib/recruitment/recruitment.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

const SAVED_KEY = (slug: string) => `erp.career.saved.${slug}`
const ALL = "__all"

/** Saved jobs: a per-visitor convenience kept in this browser only. */
function useSaved(slug: string) {
  const read = React.useCallback(() => {
    try {
      return localStorage.getItem(SAVED_KEY(slug)) ?? "[]"
    } catch {
      return "[]"
    }
  }, [slug])
  const raw = React.useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb)
      window.addEventListener("erp-career-saved", cb)
      return () => {
        window.removeEventListener("storage", cb)
        window.removeEventListener("erp-career-saved", cb)
      }
    },
    read,
    () => "[]",
  )
  const ids = React.useMemo(() => JSON.parse(raw) as string[], [raw])
  const toggle = (id: string) => {
    try {
      localStorage.setItem(SAVED_KEY(slug), JSON.stringify(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
      window.dispatchEvent(new Event("erp-career-saved"))
    } catch {
      /* storage unavailable: nothing is kept */
    }
  }
  return { ids, toggle }
}

/**
 * §17 public career portal at /careers/{slug}, no sign-in (GET /public/career/{slug}, /jobs, /jobs/{id}, /filters,
 * /track; POST /jobs/{id}/apply multipart). The backend checks the rules (REC_016 already applied, REC_017 required
 * answers, REC_048 closed, REC_049 terms, REC_050 resume, REC_019/020 file type / size) and its message is shown.
 */
export default function CareerPortalPage() {
  const { slug } = useParams<{ slug: string }>()
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [site, setSite] = React.useState<Site | null>()
  const [error, setError] = React.useState<string>()
  const [filters, setFilters] = React.useState<{ locations?: { id?: string; name?: string }[]; jobTypes?: { id?: string; name?: string }[] }>()
  const [q, setQ] = React.useState({ keyword: "", locationId: "", jobTypeId: "" })
  const [draft, setDraft] = React.useState("")
  const [jobs, setJobs] = React.useState<JobCard[]>()
  const [openJob, setOpenJob] = React.useState<string>()
  const [tab, setTab] = React.useState<"jobs" | "saved" | "track">("jobs")
  const saved = useSaved(slug)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([CareerPortal.site(slug), CareerPortal.filters(slug).catch(() => undefined)])
      .then(([s, f]) => {
        if (cancelled) return
        setSite(s)
        setFilters(f)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        setSite(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  React.useEffect(() => {
    if (!site) return
    let cancelled = false
    CareerPortal.jobs(slug, { keyword: q.keyword || undefined, locationId: q.locationId || undefined, jobTypeIds: q.jobTypeId || undefined })
      .then((r) => !cancelled && setJobs(Array.isArray(r) ? r : (r.content ?? [])))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [slug, site, q])

  if (site === undefined) return <Skeleton className="mx-auto my-10 h-64 w-full max-w-4xl" />
  if (site === null)
    return (
      <div className="mx-auto max-w-xl p-6">
        <Alert variant="destructive">
          <AlertDescription>{error ?? t("cp.notFound")}</AlertDescription>
        </Alert>
      </div>
    )
  const shown = tab === "saved" ? (jobs ?? []).filter((j) => saved.ids.includes(j.id ?? "")) : (jobs ?? [])
  return (
    <div className="bg-muted/30 min-h-svh">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-8">
          <p className="text-muted-foreground text-sm">{site.displayName}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{site.headline || t("cp.headline")}</h1>
          {site.tagline && <p className="text-muted-foreground">{site.tagline}</p>}
          <p className="text-sm">{t("cp.openJobs", { n: site.openJobs ?? 0 })}</p>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
        <div className="flex flex-wrap gap-2" role="tablist">
          {(["jobs", "saved", "track"] as const).map((x) => (
            <Button key={x} role="tab" aria-selected={tab === x} variant={tab === x ? "default" : "outline"} size="sm" onClick={() => (setTab(x), setOpenJob(undefined))}>
              {t(`cp.tab.${x}`)}
              {x === "saved" && saved.ids.length > 0 && ` (${saved.ids.length})`}
            </Button>
          ))}
        </div>
        {tab === "track" ? (
          <Track slug={slug} />
        ) : openJob ? (
          <JobView slug={slug} id={openJob} saved={saved} onBack={() => setOpenJob(undefined)} onOpen={setOpenJob} />
        ) : (
          <>
            {tab === "jobs" && (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  setQ((x) => ({ ...x, keyword: draft.trim() }))
                }}
              >
                <Input className="w-64 bg-white dark:bg-transparent" aria-label={t("cp.search")} placeholder={t("cp.search")} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <Button type="submit" variant="outline" size="icon" aria-label={t("cp.search")}>
                  <Search className="size-4" />
                </Button>
                <Select value={q.locationId || ALL} onValueChange={(v) => setQ((x) => ({ ...x, locationId: v === ALL ? "" : v }))}>
                  <SelectTrigger className="w-48" aria-label={t("cp.location")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("cp.allLocations")}</SelectItem>
                    {(filters?.locations ?? []).map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={q.jobTypeId || ALL} onValueChange={(v) => setQ((x) => ({ ...x, jobTypeId: v === ALL ? "" : v }))}>
                  <SelectTrigger className="w-44" aria-label={t("cp.jobType")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("cp.allJobTypes")}</SelectItem>
                    {(filters?.jobTypes ?? []).map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </form>
            )}
            {!jobs ? (
              <Skeleton className="h-40 w-full" />
            ) : shown.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">{t(tab === "saved" ? "cp.noSaved" : "cp.noJobs")}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {shown.map((j) => (
                  <Card key={j.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setOpenJob(j.id)}>
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-2 text-base">
                        <span>
                          {j.title} {j.featured && <Badge variant="secondary">{t("rc.featured")}</Badge>}
                        </span>
                        <SaveButton id={j.id ?? ""} saved={saved} />
                      </CardTitle>
                      <CardDescription className="flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" /> {j.location?.remote ? t("rc.remote") : (j.location?.name ?? "-")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="size-3.5" /> {j.jobType?.name ?? "-"}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm">
                      {(j.minSalary != null || j.maxSalary != null) && (
                        <span>
                          {money(j.minSalary)} – {money(j.maxSalary)}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {(j.skills ?? []).slice(0, 6).map((s) => (
                          <Badge key={s} variant="outline">
                            {s}
                          </Badge>
                        ))}
                      </div>
                      {j.applicationDeadline && <span className="text-muted-foreground text-xs">{t("cp.deadline", { date: formatDate(j.applicationDeadline, language) })}</span>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function SaveButton({ id, saved }: { id: string; saved: { ids: string[]; toggle: (id: string) => void } }) {
  const t = useT()
  const on = saved.ids.includes(id)
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={on}
      aria-label={on ? t("cp.unsave") : t("cp.save")}
      onClick={(e) => {
        e.stopPropagation()
        saved.toggle(id)
      }}
    >
      {on ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
    </Button>
  )
}

function JobView({ slug, id, saved, onBack, onOpen }: { slug: string; id: string; saved: { ids: string[]; toggle: (id: string) => void }; onBack: () => void; onOpen: (id: string) => void }) {
  const t = useT()
  const money = useMoney()
  const [d, setD] = React.useState<JobDetail | null>()
  const [error, setError] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    CareerPortal.job(slug, id)
      .then((x) => !cancelled && setD(x))
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        setD(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug, id])
  if (d === undefined) return <Skeleton className="h-64 w-full" />
  if (d === null)
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  const j = d.job ?? {}
  const section = (k: TranslationKey, v?: string | null) =>
    v ? (
      <div className="grid gap-1">
        <h3 className="font-medium">{t(k)}</h3>
        <p className="text-sm whitespace-pre-wrap">{v}</p>
      </div>
    ) : null
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card>
        <CardHeader>
          <Button variant="link" className="w-fit px-0" onClick={onBack}>
            ← {t("cp.back")}
          </Button>
          <CardTitle className="flex items-start justify-between gap-2 text-xl">
            {j.title}
            <SaveButton id={id} saved={saved} />
          </CardTitle>
          <CardDescription>
            {[j.location?.remote ? t("rc.remote") : j.location?.name, j.jobType?.name, d.department, j.branch].filter(Boolean).join(" · ")}
            {(j.minSalary != null || j.maxSalary != null) && ` · ${money(j.minSalary)} – ${money(j.maxSalary)}`}
            {d.minExperience != null && ` · ${t("cp.experience", { min: d.minExperience, max: d.maxExperience ?? "+" })}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {section("hr.f.description", d.description)}
          {section("rc.requirements", d.requirements)}
          {section("rc.benefits", d.benefits)}
          {!!d.similarJobs?.length && (
            <div className="grid gap-1">
              <h3 className="font-medium">{t("cp.similar")}</h3>
              {d.similarJobs.map((s) => (
                <Button key={s.id} variant="link" className="h-auto w-fit px-0" onClick={() => onOpen(s.id ?? "")}>
                  {s.title}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {d.applicationType === "CUSTOM" && d.applicationUrl ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("cp.applyElsewhere")}</CardTitle>
          </CardHeader>
          <CardContent>
            <a href={d.applicationUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {d.applicationUrl}
            </a>
          </CardContent>
        </Card>
      ) : (
        <ApplyForm slug={slug} id={id} detail={d} />
      )}
    </div>
  )
}

/** Apply: personal and professional info, the job's questions, resume (required), cover letter, terms. */
function ApplyForm({ slug, id, detail }: { slug: string; id: string; detail: JobDetail }) {
  const t = useT()
  const [v, setV] = React.useState<Record<string, string>>({ firstName: "", lastName: "", email: "", phone: "", gender: "", dateOfBirth: "", city: "", country: "", currentPosition: "", currentCompany: "", experienceYears: "", expectedSalary: "", coverLetterMessage: "" })
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({})
  const [resume, setResume] = React.useState<File>()
  const [coverFile, setCoverFile] = React.useState<File>()
  const [terms, setTerms] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [done, setDone] = React.useState<{ trackingId?: string; jobTitle?: string }>()
  const set = (k: string, x: string) => setV((s) => ({ ...s, [k]: x }))
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)
  const missingQ = (detail.questions ?? []).filter((q) => q.required && !String(answers[q.id ?? ""] ?? "").length)
  const fileOk = (f?: File) => !f || /\.(pdf|docx?)$/i.test(f.name)
  const errs = {
    firstName: !v.firstName.trim(),
    lastName: !v.lastName.trim(),
    email: !emailOk,
    resume: !resume || !fileOk(resume),
    terms: detail.showTerms && !terms,
    questions: missingQ.length > 0,
  }
  const valid = !Object.values(errs).some(Boolean) && fileOk(coverFile)

  if (done)
    return (
      <Card>
        <CardContent className="grid gap-3 pt-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <p className="font-medium">{t("cp.applied", { job: done.jobTitle ?? "" })}</p>
          <p className="text-sm">{t("cp.trackingId")}</p>
          <p className="font-mono text-lg" data-testid="tracking-id">
            {done.trackingId}
          </p>
          <p className="text-muted-foreground text-xs">{t("cp.trackingHint")}</p>
        </CardContent>
      </Card>
    )
  async function submit() {
    setTried(true)
    if (!valid) return
    setBusy(true)
    setError(undefined)
    const num = (s: string) => (s.trim() === "" ? undefined : Number(s))
    const application = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim() || undefined,
      gender: detail.askGender ? v.gender || undefined : undefined,
      dateOfBirth: detail.askDateOfBirth ? v.dateOfBirth || undefined : undefined,
      city: v.city.trim() || undefined,
      country: v.country.trim() || undefined,
      currentPosition: v.currentPosition.trim() || undefined,
      currentCompany: v.currentCompany.trim() || undefined,
      experienceYears: num(v.experienceYears),
      expectedSalary: num(v.expectedSalary),
      coverLetterMessage: detail.showCoverLetter ? v.coverLetterMessage.trim() || undefined : undefined,
      termsAccepted: detail.showTerms ? terms : undefined,
      answers: Object.entries(answers)
        .filter(([, a]) => (Array.isArray(a) ? a.length : String(a).trim()))
        .map(([questionId, a]) => ({ questionId: Number(questionId), answer: Array.isArray(a) ? a.join(", ") : String(a).trim() })),
    }
    try {
      setDone(await CareerPortal.apply(slug, id, application, resume, detail.showCoverLetter ? coverFile : undefined))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const field = (k: string, label: TranslationKey, type = "text", required = false, invalid = false) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`ap-${k}`}>
        {t(label)}
        {required && " *"}
      </Label>
      <Input id={`ap-${k}`} type={type} value={v[k]} aria-invalid={tried && invalid} onChange={(e) => set(k, e.target.value)} />
      {tried && invalid && <FieldError message={t(k === "email" ? "hr.v.email" : "hr.v.required")} />}
    </div>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("cp.apply")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {field("firstName", "rc.firstName", "text", true, errs.firstName)}
          {field("lastName", "rc.lastName", "text", true, errs.lastName)}
        </div>
        {field("email", "hr.f.email", "email", true, errs.email)}
        {field("phone", "hr.f.phone", "tel")}
        {detail.askGender && (
          <div className="grid gap-1.5">
            <Label>{t("hr.f.gender")}</Label>
            <Select value={v.gender || ALL} onValueChange={(x) => set("gender", x === ALL ? "" : x)}>
              <SelectTrigger aria-label={t("hr.f.gender")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>-</SelectItem>
                {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                  <SelectItem key={g} value={g}>
                    {t(`hr.gender.${g}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {detail.askDateOfBirth && field("dateOfBirth", "hr.f.dateOfBirth", "date")}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {field("city", "hr.f.city")}
          {field("country", "hr.f.country")}
          {field("currentPosition", "rc.currentPosition")}
          {field("currentCompany", "rc.currentCompany")}
          {field("experienceYears", "rc.experienceYears", "number")}
          {field("expectedSalary", "rc.expectedSalary", "number")}
        </div>
        {(detail.questions ?? []).map((q) => (
          <QuestionInput key={q.id} q={q} value={answers[q.id ?? ""]} invalid={tried && missingQ.includes(q)} onChange={(a) => setAnswers((s) => ({ ...s, [q.id ?? ""]: a }))} />
        ))}
        <div className="grid gap-1.5">
          <Label htmlFor="ap-resume">{t("cp.resume")} *</Label>
          <Input id="ap-resume" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResume(e.target.files?.[0])} />
          {tried && errs.resume && <FieldError message={t("cp.v.resume")} />}
        </div>
        {detail.showCoverLetter && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-cover">{t("rc.coverLetter")}</Label>
              <Textarea id="ap-cover" rows={3} maxLength={5000} value={v.coverLetterMessage} onChange={(e) => set("coverLetterMessage", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-cover-file">{t("cp.coverLetterFile")}</Label>
              <Input id="ap-cover-file" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCoverFile(e.target.files?.[0])} />
            </div>
          </>
        )}
        {detail.showTerms && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={terms} onCheckedChange={(c) => setTerms(c === true)} aria-label={t("cp.terms")} /> {t("cp.terms")}
          </label>
        )}
        {tried && errs.terms && <FieldError message={t("cp.v.terms")} />}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button disabled={busy} onClick={submit}>
          {t("cp.submit")}
        </Button>
      </CardContent>
    </Card>
  )
}

function QuestionInput({ q, value, invalid, onChange }: { q: PublicQuestion; value?: string | string[]; invalid: boolean; onChange: (v: string | string[]) => void }) {
  const t = useT()
  const id = `q-${q.id}`
  const label = (
    <Label htmlFor={id}>
      {q.question}
      {q.required && " *"}
    </Label>
  )
  const str = typeof value === "string" ? value : ""
  const list = Array.isArray(value) ? value : []
  return (
    <div className="grid gap-1.5">
      {label}
      {q.type === "TEXTAREA" ? (
        <Textarea id={id} rows={3} maxLength={5000} value={str} onChange={(e) => onChange(e.target.value)} />
      ) : q.type === "SELECT" || q.type === "RADIO" ? (
        <Select value={str || undefined} onValueChange={onChange}>
          <SelectTrigger id={id} aria-label={q.question}>
            <SelectValue placeholder={t("sales.choose")} />
          </SelectTrigger>
          <SelectContent>
            {(q.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : q.type === "CHECKBOX" ? (
        <div className="flex flex-wrap gap-3" role="group" aria-label={q.question}>
          {(q.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox checked={list.includes(o)} onCheckedChange={(c) => onChange(c === true ? [...list, o] : list.filter((x) => x !== o))} /> {o}
            </label>
          ))}
        </div>
      ) : (
        <Input id={id} type={q.type === "NUMBER" ? "number" : q.type === "DATE" ? "date" : "text"} value={str} onChange={(e) => onChange(e.target.value)} />
      )}
      {invalid && <FieldError message={t("hr.v.required")} />}
    </div>
  )
}

/** Track an application by tracking ID + email (REC_059 when nothing matches). */
function Track({ slug }: { slug: string }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [trackingId, setTrackingId] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [res, setRes] = React.useState<{ jobTitle?: string; applicationDate?: string; status?: string }>()
  const [error, setError] = React.useState<string>()
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">{t("cp.track")}</CardTitle>
        <CardDescription>{t("cp.trackHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(undefined)
            setRes(undefined)
            try {
              setRes(await CareerPortal.track(slug, trackingId.trim(), email.trim()))
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="tr-id">{t("cp.trackingId")}</Label>
            <Input id="tr-id" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tr-email">{t("hr.f.email")}</Label>
            <Input id="tr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={!trackingId.trim() || !email.trim()}>
            {t("cp.trackButton")}
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {res && (
            <Alert>
              <AlertDescription data-testid="track-result">
                {res.jobTitle} · {formatDate(res.applicationDate, language)} · <b>{t(`cp.status.${res.status ?? "NEW"}` as TranslationKey)}</b>
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
