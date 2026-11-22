"use client"

import * as React from "react"
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EVENTS, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { CrudSection, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig } from "../_components/crud-kit"

export default function EventsPage() {
  return (
    <React.Suspense>
      <Events />
    </React.Suspense>
  )
}

const hm = (v: unknown) => (v ? String(v).slice(0, 5) : "")
const STATUSES = ["PENDING", "APPROVED", "REJECTED"]

/** §15 events: Pending → Approved / Rejected for departments, a month calendar of approved events, and event types. */
function Events() {
  const t = useT()
  const perms = useAuthStore((s) => s.me?.permissions) ?? []
  const manage = perms.includes("EVENT_MANAGE")
  const approve = perms.includes("EVENT_APPROVE")
  return (
    <TabbedPage
      title={t("menu.hr.events")}
      description={t("hr.ev.subtitle")}
      tabs={[
        { key: "list", label: "menu.hr.events", content: () => <EventList manage={manage} approve={approve} /> },
        { key: "calendar", label: "hr.ev.calendar", content: () => <EventCalendar /> },
        { key: "types", label: "hr.ev.types", content: () => <EventTypes manage={manage} /> },
      ]}
    />
  )
}

function EventList({ manage, approve }: { manage: boolean; approve: boolean }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const types = toSelect(useOptions("eventTypes", EVENTS.typeOptions))
  const departments = toSelect(useOptions("departments", () => HrOptions.departments()))
  const when = (r: Row) => {
    const days = r.startDate === r.endDate ? formatDate(String(r.startDate ?? ""), language) : `${formatDate(String(r.startDate ?? ""), language)} → ${formatDate(String(r.endDate ?? ""), language)}`
    return r.startTime ? `${days} · ${hm(r.startTime)}–${hm(r.endTime)}` : `${days} · ${t("hr.ev.allDay")}`
  }
  const cfg: CrudConfig = {
    id: "events",
    load: EVENTS.events.list,
    keyword: true,
    statuses: STATUSES,
    columns: [
      {
        label: "hr.f.title",
        render: (r) => (
          <span className="flex items-center gap-2 font-medium">
            <span className="size-3 shrink-0 rounded-full" style={{ background: String(r.color ?? "#3B82F6") }} aria-hidden />
            {String(r.title ?? "")}
          </span>
        ),
      },
      { label: "hr.ev.type", path: "eventType.name" },
      { label: "hr.ev.when", render: when },
      { label: "hr.ev.location", path: "location" },
      { label: "hr.f.departments", render: (r) => ((r.departments as { name?: string }[]) ?? []).map((d) => d.name).join(", ") || "-" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "hr.ev.create",
    fields: [
      { name: "title", label: "hr.f.title", required: true, max: 200, full: true },
      { name: "eventTypeId", label: "hr.ev.type", type: "select", required: true, numeric: true, options: types },
      { name: "color", label: "hr.f.color", type: "color" },
      { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
      { name: "endDate", label: "hr.f.endDate", type: "date", required: true, check: (v) => (v.startDate && v.endDate && String(v.endDate) < String(v.startDate) ? "hr.v.endAfterStart" : undefined) },
      { name: "startTime", label: "hr.f.startTime", type: "time", check: (v) => (!!v.startTime !== !!v.endTime ? "hr.ev.bothTimes" : undefined) },
      {
        name: "endTime",
        label: "hr.f.endTime",
        type: "time",
        check: (v) => (!!v.startTime !== !!v.endTime ? "hr.ev.bothTimes" : v.startDate === v.endDate && v.startTime && v.endTime && String(v.endTime) <= String(v.startTime) ? "hr.v.endAfterStart" : undefined),
      },
      { name: "location", label: "hr.ev.location", max: 500, full: true },
      { name: "departmentIds", label: "hr.f.departments", type: "multi", required: true, options: departments },
      { name: "description", label: "hr.f.description", type: "textarea", max: 4000 },
    ],
    toValues: (r) => ({
      ...r,
      eventTypeId: pick(r, "eventType.id"),
      startTime: hm(r.startTime),
      endTime: hm(r.endTime),
      departmentIds: ((r.departments as { id?: string }[]) ?? []).map((d) => d.id),
    }),
    fetchRow: (r) => EVENTS.events.get(r.id ?? ""),
    save: manage ? EVENTS.events.save : undefined,
    remove: manage ? EVENTS.events.remove : undefined,
    actions: approve
      ? [
          { key: "approve", label: "hr.approve", icon: <Check className="size-4" />, when: (r: Row) => r.status === "PENDING", run: (r) => EVENTS.events.put(r.id ?? "", "approve") },
          { key: "reject", label: "hr.reject", icon: <X className="size-4" />, destructive: true, when: (r: Row) => r.status === "PENDING", run: (r) => EVENTS.events.put(r.id ?? "", "reject") },
        ]
      : [],
    manage: manage || approve,
  }
  return (
    <>
      {manage && <p className="text-muted-foreground text-xs">{t("hr.ev.editHint")}</p>}
      <CrudSection config={cfg} />
    </>
  )
}

function EventTypes({ manage }: { manage: boolean }) {
  const t = useT()
  const cfg: CrudConfig = {
    id: "eventTypes",
    load: EVENTS.types.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.description", path: "description" },
      { label: "hr.ev.totalEvents", path: "totalEvents" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.ev.createType",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150, full: true },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
      { name: "status", label: "hr.f.status", type: "select", options: ["ACTIVE", "INACTIVE"].map((s) => ({ value: s, label: t(`hr.status.${s}` as "hr.status.ACTIVE") })) },
    ],
    defaults: { status: "ACTIVE" },
    save: EVENTS.types.save,
    remove: EVENTS.types.remove,
    canDelete: (r) => !Number(r.totalEvents),
    invalidates: true,
    manage,
  }
  return <CrudSection config={cfg} />
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Month grid (Monday first) of the approved events; GET /events/calendar takes at most 92 days, a 6-week grid is 42. */
function EventCalendar() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [month, setMonth] = React.useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const start = new Date(month)
  start.setDate(1 - ((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const from = iso(days[0])
  const to = iso(days[41])
  const [data, setData] = React.useState<{ key: string; rows?: Row[]; error?: string }>()
  React.useEffect(() => {
    let cancelled = false
    EVENTS.calendar(from, to)
      .then((rows) => !cancelled && setData({ key: from, rows }))
      .catch((e: unknown) => !cancelled && setData({ key: from, rows: [], error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
  }, [from, to])
  const rows = data?.key === from ? (data.rows ?? []) : undefined
  const weekdays = days.slice(0, 7).map((d) => d.toLocaleDateString(language, { weekday: "short" }))
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  return (
    <Card>
      <CardContent className="grid gap-3 pt-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("hr.ev.prevMonth")} onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t("hr.ev.nextMonth")} onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="font-semibold" data-testid="event-month">
            {month.toLocaleDateString(language, { month: "long", year: "numeric" })}
          </h2>
          {!rows && <span className="text-muted-foreground text-xs">…</span>}
        </div>
        {data?.error && data.key === from && <p className="text-destructive text-sm">{data.error}</p>}
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-md border bg-border text-xs">
            {weekdays.map((w) => (
              <div key={w} className="bg-muted p-1 text-center font-medium">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const k = iso(d)
              const items = (rows ?? []).filter((r) => String(r.startDate) <= k && k <= String(r.endDate))
              return (
                <div key={k} className={`bg-background min-h-24 p-1 ${d.getMonth() !== month.getMonth() ? "text-muted-foreground" : ""}`} data-testid={`day-${k}`}>
                  <div className="mb-1 text-right">{d.getDate()}</div>
                  <div className="grid gap-0.5">
                    {items.map((r) => (
                      <Badge
                        key={String(r.id)}
                        className="block w-full truncate text-left text-white"
                        style={{ background: String(r.color ?? "#3B82F6") }}
                        title={`${String(r.title ?? "")}${r.location ? ` · ${String(r.location)}` : ""}`}
                      >
                        {r.startTime && k === r.startDate ? `${hm(r.startTime)} ` : ""}
                        {String(r.title ?? "")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">{t("hr.ev.calendarHint")}</p>
      </CardContent>
    </Card>
  )
}
