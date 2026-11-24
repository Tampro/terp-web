"use client"

import * as React from "react"
import { Gauge, Play, Star, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useUrlQuery } from "@/hooks/use-url-query"
import { HrOptions, PERF, PerfOptions, ReviewService, type ReviewDto, type Row } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, Field, PlainSelect, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../_components/crud-kit"

const KINDS = ["indicator-categories", "goal-types"] as const

export default function PerformancePage() {
  return (
    <React.Suspense>
      <Performance />
    </React.Suspense>
  )
}

/** §16 performance: reviews (Pending → In Progress → Completed, 5-star ratings per indicator, pros / cons), goals, review cycles, indicators and their categories / goal types. */
function Performance() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("PERFORMANCE_MANAGE")
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const cycles = toSelect(useOptions("perf:cycles", PerfOptions.cycles))
  const goalTypes = toSelect(useOptions("perf:goal-types", () => PerfOptions.catalog("goal-types")))
  const categories = toSelect(useOptions("perf:indicator-categories", () => PerfOptions.catalog("indicator-categories")))
  const active = (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) }))
  const [conducting, setConducting] = React.useState<string>()
  const [reloadReviews, setReloadReviews] = React.useState(0)
  const is = (...s: string[]) => (r: Row) => s.includes(String(r.status))

  const reviews: CrudConfig = {
    id: "reviews",
    load: PERF.reviews.list,
    countsPath: "/v1/performance/reviews/status-counts",
    keyword: true,
    statuses: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
    reloadKey: reloadReviews,
    onRowClick: (r) => setConducting(r.id),
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "pf.reviewer", path: "reviewer.fullName" },
      { label: "pf.cycle", path: "reviewCycle.name" },
      { label: "hr.f.date", path: "reviewDate", kind: "date" },
      { label: "pf.overall", render: (r) => <Stars value={r.overallRating as number | null} /> },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(pick(r, "employee.fullName") ?? ""),
    createLabel: "pf.review.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "reviewerId", label: "pf.reviewer", type: "select", required: true, numeric: true, options: employees, check: (v) => (v.reviewerId && v.reviewerId === v.employeeId ? "pf.v.selfReview" : undefined) },
      { name: "reviewCycleId", label: "pf.cycle", type: "select", required: true, numeric: true, options: cycles },
      { name: "reviewDate", label: "hr.f.date", type: "date", required: true },
    ],
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), reviewerId: pick(r, "reviewer.id"), reviewCycleId: pick(r, "reviewCycle.id") }),
    save: PERF.reviews.save,
    remove: PERF.reviews.remove,
    canEdit: is("PENDING", "IN_PROGRESS"),
    canDelete: is("PENDING", "CANCELLED"),
    actions: [
      { key: "start", label: "pf.review.start", icon: <Play className="size-4" />, when: is("PENDING"), run: (r) => PERF.reviews.put(r.id ?? "", "status", { status: "IN_PROGRESS" }) },
      { key: "cancel", label: "pf.review.cancel", icon: <X className="size-4" />, when: is("PENDING", "IN_PROGRESS"), destructive: true, run: (r) => PERF.reviews.put(r.id ?? "", "status", { status: "CANCELLED" }) },
    ],
    manage,
  }
  const goalStatus = (["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) }))
  const goals: CrudConfig = {
    id: "goals",
    load: PERF.goals.list,
    countsPath: "/v1/performance/goals/status-counts",
    keyword: true,
    statuses: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"],
    columns: [
      { label: "hr.f.title", path: "title" },
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "pf.goalType", path: "goalType.name" },
      { label: "hr.f.period", render: (r) => `${formatDate(String(r.startDate ?? ""), language)} → ${formatDate(String(r.endDate ?? ""), language)}` },
      { label: "pf.target", path: "target" },
      {
        label: "pf.progress",
        render: (r) => (
          <div className="flex min-w-28 items-center gap-2">
            <Progress value={Number(r.progress ?? 0)} aria-label={t("pf.progress")} />
            <span className="text-xs">{Number(r.progress ?? 0)}%</span>
          </div>
        ),
      },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "pf.goal.create",
    fields: [
      { name: "title", label: "hr.f.title", required: true, max: 200, full: true },
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "goalTypeId", label: "pf.goalType", type: "select", required: true, numeric: true, options: goalTypes },
      { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
      { name: "endDate", label: "hr.f.endDate", type: "date", required: true, check: (v) => (v.startDate && v.endDate && String(v.endDate) < String(v.startDate) ? "hr.v.endAfterStart" : undefined) },
      { name: "target", label: "pf.target", max: 200 },
      { name: "progress", label: "pf.progressPct", type: "number", min: 0, max: 100 },
      { name: "status", label: "hr.f.status", type: "select", options: goalStatus },
      { name: "description", label: "hr.f.description", type: "textarea", max: 5000 },
    ],
    defaults: { status: "NOT_STARTED", progress: "0" },
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), goalTypeId: pick(r, "goalType.id") }),
    save: PERF.goals.save,
    remove: PERF.goals.remove,
    actions: [
      {
        key: "progress",
        label: "pf.updateProgress",
        icon: <Gauge className="size-4" />,
        when: is("NOT_STARTED", "IN_PROGRESS", "OVERDUE"),
        fields: [{ name: "progress", label: "pf.progressPct", type: "number", required: true, min: 0, max: 100, check: (v) => (!Number.isInteger(Number(v.progress)) ? "hr.v.integer" : undefined) }],
        run: (r, b) => PERF.goals.put(r.id ?? "", "progress", b),
      },
    ],
    manage,
  }
  const cyclesCfg: CrudConfig = {
    id: "cycles",
    load: PERF.cycles.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.frequency", render: (r) => t(`pf.freq.${String(r.frequency)}` as TranslationKey) },
      { label: "hr.f.description", path: "description" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "pf.cycle.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "frequency", label: "hr.f.frequency", type: "select", required: true, options: (["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const).map((f) => ({ value: f, label: t(`pf.freq.${f}`) })) },
      { name: "status", label: "hr.f.status", type: "select", options: active },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
    ],
    defaults: { frequency: "QUARTERLY", status: "ACTIVE" },
    save: PERF.cycles.save,
    remove: PERF.cycles.remove,
    invalidates: true,
    manage,
  }
  const indicators: CrudConfig = {
    id: "indicators",
    load: PERF.indicators.list,
    countsPath: "/v1/performance/indicators/status-counts",
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.category", path: "category.name" },
      { label: "pf.unit", path: "measurementUnit" },
      { label: "pf.target", path: "targetValue" },
      { label: "pf.weight", path: "weight" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "pf.indicator.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "categoryId", label: "hr.f.category", type: "select", required: true, numeric: true, options: categories },
      { name: "measurementUnit", label: "pf.unit", max: 50 },
      { name: "targetValue", label: "pf.target", max: 100 },
      { name: "weight", label: "pf.weight", type: "number", min: 0, max: 1000 },
      { name: "status", label: "hr.f.status", type: "select", options: active },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE" },
    toValues: (r) => ({ ...r, categoryId: pick(r, "category.id") }),
    save: PERF.indicators.save,
    remove: PERF.indicators.remove,
    manage,
  }
  return (
    <>
      <TabbedPage
        title={t("menu.pf.performance")}
        description={t("pf.subtitle")}
        tabs={[
          { key: "reviews", label: "pf.reviews", content: () => <CrudSection config={reviews} /> },
          { key: "goals", label: "pf.goals", content: () => <CrudSection config={goals} /> },
          { key: "cycles", label: "pf.cycles", content: () => <CrudSection config={cyclesCfg} /> },
          { key: "indicators", label: "pf.indicators", content: () => <CrudSection config={indicators} /> },
          { key: "catalogs", label: "pf.catalogs", content: () => <CatalogTab manage={manage} /> },
        ]}
      />
      <Dialog open={!!conducting} onOpenChange={(o) => !o && setConducting(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {conducting && (
            <ConductReview
              key={conducting}
              id={conducting}
              manage={manage}
              onClose={() => setConducting(undefined)}
              onSaved={() => setReloadReviews((x) => x + 1)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Stars({ value }: { value?: number | null }) {
  if (value == null) return <span>-</span>
  return (
    <span className="inline-flex items-center gap-1" title={String(value)}>
      <Star className="size-4 fill-amber-400 text-amber-400" /> {value.toFixed(1)}
    </span>
  )
}

/** Conduct review: 1–5 stars and a comment per indicator (grouped by category), overall comments, pros, cons; Save keeps it In Progress, Complete needs every indicator rated. */
function ConductReview({ id, manage, onClose, onSaved }: { id: string; manage: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [review, setReview] = React.useState<ReviewDto>()
  const [ratings, setRatings] = React.useState<Record<string, { rating?: number; comments: string }>>({})
  const [text, setText] = React.useState({ overallComments: "", pros: "", cons: "" })
  const [saving, setSaving] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    ReviewService.get(id)
      .then((r) => {
        if (cancelled) return
        setReview(r)
        const init: Record<string, { rating?: number; comments: string }> = {}
        for (const g of r.groups ?? []) for (const i of g.indicators ?? []) init[i.indicatorId ?? ""] = { rating: i.rating ?? undefined, comments: i.comments ?? "" }
        setRatings(init)
        setText({ overallComments: r.overallComments ?? "", pros: r.pros ?? "", cons: r.cons ?? "" })
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id])
  if (!review) return <Skeleton className="h-64 w-full" />
  const readOnly = !manage || review.status === "COMPLETED" || review.status === "CANCELLED"
  const ids = Object.keys(ratings)
  const allRated = ids.length > 0 && ids.every((k) => ratings[k].rating)
  const rated = ids.map((k) => ratings[k].rating).filter((x): x is number => !!x)
  const avg = rated.length ? rated.reduce((s, x) => s + x, 0) / rated.length : undefined
  async function save(submit: boolean) {
    setSaving(true)
    const ok = await attempt(
      () =>
        ReviewService.conduct(id, {
          ratings: ids.map((k) => ({ indicatorId: Number(k), rating: ratings[k].rating, comments: ratings[k].comments.trim() || undefined })),
          overallComments: text.overallComments.trim() || undefined,
          pros: text.pros.trim() || undefined,
          cons: text.cons.trim() || undefined,
          submit,
        }),
      t("common.saved"),
    )
    setSaving(false)
    if (ok) {
      onSaved()
      if (submit) onClose()
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("pf.review.title", { name: review.employee?.fullName ?? "" })}</DialogTitle>
        <DialogDescription>
          {t("pf.reviewer")}: {review.reviewer?.fullName} · {review.reviewCycle?.name} · {review.reviewDate} · {t(`hr.status.${review.status ?? "PENDING"}` as TranslationKey)}
        </DialogDescription>
      </DialogHeader>
      {ids.length === 0 && <p className="text-muted-foreground text-sm">{t("pf.noIndicators")}</p>}
      {(review.groups ?? []).map((g) => (
        <Card key={g.category}>
          <CardHeader>
            <CardTitle className="text-base">{g.category}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(g.indicators ?? []).map((i) => {
              const k = i.indicatorId ?? ""
              const cur = ratings[k] ?? { comments: "" }
              return (
                <div key={k} className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{i.indicatorName}</span>
                      {(i.targetValue || i.measurementUnit) && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {t("pf.target")}: {[i.targetValue, i.measurementUnit].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </div>
                    <div className="flex" role="radiogroup" aria-label={t("pf.ratingOf", { name: i.indicatorName ?? "" })}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={cur.rating === n}
                          aria-label={t("pf.stars", { n })}
                          disabled={readOnly}
                          className="p-0.5 disabled:cursor-default"
                          onClick={() => setRatings((r) => ({ ...r, [k]: { ...cur, rating: n } }))}
                        >
                          <Star className={`size-5 ${(cur.rating ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input aria-label={t("pf.commentOf", { name: i.indicatorName ?? "" })} placeholder={t("hr.f.comment")} maxLength={5000} disabled={readOnly} value={cur.comments} onChange={(e) => setRatings((r) => ({ ...r, [k]: { ...cur, comments: e.target.value } }))} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
      <p className="text-sm" data-testid="review-average">
        {t("pf.overall")}: {avg != null ? avg.toFixed(1) : "-"} / 5
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="rv-pros" label={t("pf.pros")}>
          <Textarea id="rv-pros" rows={2} maxLength={5000} disabled={readOnly} value={text.pros} onChange={(e) => setText({ ...text, pros: e.target.value })} />
        </Field>
        <Field id="rv-cons" label={t("pf.cons")}>
          <Textarea id="rv-cons" rows={2} maxLength={5000} disabled={readOnly} value={text.cons} onChange={(e) => setText({ ...text, cons: e.target.value })} />
        </Field>
        <Field id="rv-overall" label={t("pf.overallComments")} className="sm:col-span-2">
          <Textarea id="rv-overall" rows={2} maxLength={5000} disabled={readOnly} value={text.overallComments} onChange={(e) => setText({ ...text, overallComments: e.target.value })} />
        </Field>
      </div>
      {!readOnly && (
        <DialogFooter>
          {!allRated && <span className="text-muted-foreground mr-auto self-center text-xs">{t("pf.rateAll")}</span>}
          <Button variant="outline" disabled={saving} onClick={() => save(false)}>
            {t("pf.saveRatings")}
          </Button>
          <Button disabled={saving || !allRated} onClick={() => save(true)}>
            {t("pf.complete")}
          </Button>
        </DialogFooter>
      )}
    </>
  )
}

/** Indicator categories and goal types: /performance/{indicator-categories|goal-types}. */
function CatalogTab({ manage }: { manage: boolean }) {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const kind = KINDS.find((k) => k === searchParams.get("kind")) ?? KINDS[0]
  const api = PERF.catalog(kind)
  const fields: FieldDef[] = [
    { name: "name", label: "hr.f.name", required: true, max: 150 },
    { name: "status", label: "hr.f.status", type: "select", options: (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
    { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
  ]
  const cfg: CrudConfig = {
    id: `perf-${kind}`,
    load: api.list,
    countsPath: `/v1/performance/${kind}/status-counts`,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.description", path: "description" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.catalog.create",
    fields,
    defaults: { status: "ACTIVE" },
    save: api.save,
    remove: api.remove,
    invalidates: true,
    manage,
    toolbar: <PlainSelect label={t("hr.catalogKind")} className="w-52" value={kind} onChange={(v) => update({ kind: v, page: 0, status: "", q: "" })} options={KINDS.map((k) => ({ value: k, label: t(`pf.kind.${k}`) }))} />,
  }
  return <CrudSection config={cfg} />
}
