"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUrlQuery } from "@/hooks/use-url-query"
import { CALENDAR_KINDS, CalendarService, type CalendarEntry, type EKind, type UnifiedCalendar } from "@/lib/calendar/calendar.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

type View = "month" | "week" | "day"
const iso = (d: Date) => d.toLocaleDateString("en-CA")
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
const COLOR: Record<EKind, string> = {
  SALES_INVOICE: "bg-emerald-500",
  PURCHASE_INVOICE: "bg-orange-500",
  EVENT: "bg-violet-500",
  HOLIDAY: "bg-red-500",
  LEAVE: "bg-amber-500",
  DEAL_TASK: "bg-sky-500",
  LEAD_TASK: "bg-cyan-500",
  CONTRACT_END: "bg-rose-500",
  PROJECT_TASK: "bg-blue-600",
  ZOOM_MEETING: "bg-indigo-500",
  MEETING: "bg-fuchsia-500",
  INTERVIEW: "bg-teal-500",
  BIRTHDAY: "bg-pink-500",
}

/** The period a view shows, inside the backend's 62-day limit (REP_001). */
function range(view: View, anchor: Date) {
  if (view === "day") return { from: anchor, to: anchor }
  if (view === "week") {
    const m = mondayOf(anchor)
    return { from: m, to: addDays(m, 6) }
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = mondayOf(first)
  return { from: gridStart, to: addDays(gridStart, 41) } // 6 weeks
}

export default function CalendarPage() {
  return (
    <React.Suspense>
      <UnifiedCalendarView />
    </React.Suspense>
  )
}

/**
 * §11.3 unified calendar (month / week / day) filterable by kind: sales / purchase invoices, events, holidays, leave,
 * deal / lead tasks, contract ends, project tasks, Zoom meetings, meetings, interviews (report-service /reports/calendar).
 */
function UnifiedCalendarView() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const locale = language === "vi" ? "vi-VN" : language === "ko" ? "ko-KR" : "en-US"
  const { searchParams, update } = useUrlQuery()
  const view: View = (["week", "day"] as const).find((v) => v === searchParams.get("view")) ?? "month"
  const anchor = searchParams.get("date") ? parse(searchParams.get("date")!) : new Date()
  const kindsParam = searchParams.get("kinds")
  const kinds = (kindsParam ? kindsParam.split(",") : []).filter((k): k is EKind => (CALENDAR_KINDS as readonly string[]).includes(k))
  const { from, to } = range(view, anchor)
  const key = `${iso(from)}|${iso(to)}|${kinds.join(",")}`
  const [data, setData] = React.useState<{ key: string; cal: UnifiedCalendar }>()

  React.useEffect(() => {
    let cancelled = false
    const [f, tt, k] = key.split("|")
    CalendarService.get(f, tt, k ? (k.split(",") as EKind[]) : [])
      .then((cal) => !cancelled && setData({ key, cal }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [key])

  const cal = data?.key === key ? data.cal : undefined
  const eventsOn = (day: Date) => {
    const d = iso(day)
    return (cal?.events ?? []).filter((e) => (e.start ?? "") <= d && d <= (e.end ?? e.start ?? ""))
  }
  const shift = (dir: -1 | 1) => {
    const next =
      view === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1) : addDays(anchor, view === "week" ? 7 * dir : dir)
    update({ date: iso(next) })
  }
  const toggleKind = (k: EKind, on: boolean) => {
    const next = on ? [...kinds, k] : kinds.filter((x) => x !== k)
    update({ kinds: next.length ? next.join(",") : "" })
  }
  const title =
    view === "month"
      ? anchor.toLocaleDateString(locale, { month: "long", year: "numeric" })
      : view === "week"
        ? `${from.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${to.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const todayIso = iso(new Date())
  const chip = (e: CalendarEntry) => (
    <li key={`${e.kind}-${e.id}-${e.start}`} className="flex items-center gap-1.5 truncate text-xs" title={e.title}>
      <span className={`size-2 shrink-0 rounded-full ${COLOR[e.kind ?? "EVENT"]}`} />
      {e.startTime && <span className="text-muted-foreground">{e.startTime.slice(0, 5)}</span>}
      <span className="truncate">{e.title}</span>
    </li>
  )

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.calendar")} description={t("calendar.subtitle")}>
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && update({ view: v === "month" ? "" : v })} aria-label={t("crm.viewMode")}>
          {(["month", "week", "day"] as const).map((v) => (
            <ToggleGroupItem key={v} value={v}>
              {t(`calendar.view.${v}` as TranslationKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
        <Card className="min-w-0">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" aria-label={t("calendar.previous")} onClick={() => shift(-1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label={t("calendar.next")} onClick={() => shift(1)}>
                  <ChevronRight className="size-4" />
                </Button>
                <Button variant="outline" onClick={() => update({ date: "" })}>
                  {t("calendar.today")}
                </Button>
              </div>
              <h2 className="font-semibold capitalize" data-testid="calendar-title">
                {title}
              </h2>
            </div>
            {!cal ? (
              <Skeleton className="h-96 w-full" />
            ) : view === "month" ? (
              <div className="overflow-x-auto">
                <div className="grid min-w-[42rem] grid-cols-7 border-t border-l">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="text-muted-foreground border-r border-b p-1 text-center text-xs font-medium">
                      {addDays(from, i).toLocaleDateString(locale, { weekday: "short" })}
                    </div>
                  ))}
                  {Array.from({ length: 42 }, (_, i) => {
                    const day = addDays(from, i)
                    const list = eventsOn(day)
                    const out = day.getMonth() !== anchor.getMonth()
                    return (
                      <div key={i} className={`min-h-24 border-r border-b p-1 ${out ? "bg-muted/40" : ""}`} data-date={iso(day)}>
                        <button
                          type="button"
                          className={`mb-1 text-xs ${iso(day) === todayIso ? "bg-primary text-primary-foreground rounded-full px-1.5" : out ? "text-muted-foreground" : ""}`}
                          onClick={() => update({ view: "day", date: iso(day) })}
                        >
                          {day.getDate()}
                        </button>
                        <ul className="grid gap-0.5">{list.slice(0, 3).map(chip)}</ul>
                        {list.length > 3 && <p className="text-muted-foreground text-[11px]">{t("calendar.more", { n: list.length - 3 })}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <ol className="grid gap-3">
                {Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => {
                  const day = addDays(from, i)
                  const list = eventsOn(day)
                  return (
                    <li key={i} className="grid gap-1 rounded-md border p-3" data-date={iso(day)}>
                      <div className={`text-sm font-medium ${iso(day) === todayIso ? "text-primary" : ""}`}>
                        {day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })}
                      </div>
                      {list.length === 0 ? <p className="text-muted-foreground text-xs">{t("calendar.nothing")}</p> : <ul className="grid gap-1">{list.map(chip)}</ul>}
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardContent className="grid gap-2">
            <p className="text-sm font-medium">{t("calendar.filter")}</p>
            <p className="text-muted-foreground text-xs">{t("calendar.filterHint")}</p>
            {CALENDAR_KINDS.map((k) => {
              const blocked = cal?.unavailable?.[k]
              return (
                <label key={k} className={`flex items-center gap-2 text-sm ${blocked ? "opacity-50" : ""}`} title={blocked ?? undefined}>
                  <Checkbox checked={kinds.includes(k)} onCheckedChange={(c) => toggleKind(k, c === true)} />
                  <span className={`size-2 rounded-full ${COLOR[k]}`} />
                  <span className="flex-1">{t(`calendar.kind.${k}` as TranslationKey)}</span>
                  <span className="text-muted-foreground text-xs">{cal?.counts?.[k] ?? (blocked ? "—" : 0)}</span>
                </label>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
