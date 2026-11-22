"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useUrlQuery } from "@/hooks/use-url-query"
import { AttendanceService, HR, HrOptions, WEEK_DAYS, type AttendanceCalendar, type DayCell, type Row } from "@/lib/hrm/hrm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, PlainSelect, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig } from "../_components/crud-kit"

export default function AttendancePage() {
  return (
    <React.Suspense>
      <Attendance />
    </React.Suspense>
  )
}

/** §15 attendance: monthly grid, entries (clock in / out), shifts, working days and IP restriction. */
function Attendance() {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("ATTENDANCE_MANAGE")
  const employees = useOptions("employees", HrOptions.employees)
  const empName = (id: unknown) => employees.find((e) => e.id === String(id))?.name ?? String(id ?? "-")
  const timeRe = /^\d{2}:\d{2}(:\d{2})?$/
  const status = (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) }))

  // GET /attendance/records requires employeeId (COMMON_001 without it): pick the employee first
  const recordEmployee = searchParams.get("employeeId") ?? ""
  const records: CrudConfig = {
    id: `records-${recordEmployee}`,
    load: (q) => (recordEmployee ? HR.records.list({ ...q, employeeId: recordEmployee }) : Promise.resolve([])),
    emptyLabel: recordEmployee ? "hr.empty" : "hr.att.pickEmployee",
    defaults: { employeeId: recordEmployee },
    toolbar: <PlainSelect label={t("hr.f.employee")} className="w-60" value={recordEmployee} onChange={(v) => update({ employeeId: v, page: 0 })} options={toSelect(employees)} />,
    columns: [
      { label: "hr.f.employee", render: (r) => empName(r.employeeId) },
      { label: "hr.f.date", path: "date", kind: "date" },
      { label: "hr.f.clockIn", path: "clockIn" },
      { label: "hr.f.clockOut", path: "clockOut" },
      { label: "hr.f.totalHours", path: "totalHours" },
      { label: "hr.f.overtimeHours", path: "overtimeHours" },
      { label: "hr.f.flags", render: (r) => [r.late && t("hr.att.late"), r.earlyDeparture && t("hr.att.early")].filter(Boolean).join(", ") || "-" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => `${empName(r.employeeId)} ${r.date ?? ""}`,
    createLabel: "hr.record.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: toSelect(employees) },
      { name: "date", label: "hr.f.date", type: "date", required: true },
      { name: "clockIn", label: "hr.f.clockIn", type: "time", pattern: timeRe },
      { name: "clockOut", label: "hr.f.clockOut", type: "time", pattern: timeRe, check: (v) => (v.clockIn && v.clockOut && String(v.clockOut) <= String(v.clockIn) ? "hr.v.afterClockIn" : undefined) },
      { name: "holiday", label: "hr.f.holiday", type: "switch" },
      { name: "notes", label: "hr.f.notes", type: "textarea", max: 500 },
    ],
    toValues: (r) => ({ ...r, clockIn: String(r.clockIn ?? "").slice(0, 5), clockOut: String(r.clockOut ?? "").slice(0, 5) }),
    save: HR.records.save,
    remove: HR.records.remove,
    manage,
  }
  const shifts: CrudConfig = {
    id: "shifts",
    load: HR.shifts.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.startTime", path: "startTime" },
      { label: "hr.f.endTime", path: "endTime" },
      { label: "hr.f.breakMinutes", path: "breakDurationMinutes" },
      { label: "hr.f.graceMinutes", path: "gracePeriodMinutes" },
      { label: "hr.f.nightShift", path: "nightShift", kind: "bool" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r: Row) => String(r.name ?? ""),
    createLabel: "hr.shift.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "status", label: "hr.f.status", type: "select", options: status },
      { name: "startTime", label: "hr.f.startTime", type: "time", required: true },
      { name: "endTime", label: "hr.f.endTime", type: "time", required: true },
      { name: "breakDurationMinutes", label: "hr.f.breakMinutes", type: "number", min: 0, max: 1440 },
      { name: "gracePeriodMinutes", label: "hr.f.graceMinutes", type: "number", min: 0, max: 720 },
      { name: "breakStartTime", label: "hr.f.breakStart", type: "time" },
      { name: "breakEndTime", label: "hr.f.breakEnd", type: "time" },
      { name: "nightShift", label: "hr.f.nightShift", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
    ],
    defaults: { status: "ACTIVE" },
    toValues: (r) => ({ ...r, startTime: String(r.startTime ?? "").slice(0, 5), endTime: String(r.endTime ?? "").slice(0, 5), breakStartTime: String(r.breakStartTime ?? "").slice(0, 5), breakEndTime: String(r.breakEndTime ?? "").slice(0, 5) }),
    save: HR.shifts.save,
    remove: HR.shifts.remove,
    invalidates: true,
    manage,
  }
  return (
    <TabbedPage
      title={t("menu.hr.attendance")}
      description={t("hr.att.subtitle")}
      tabs={[
        { key: "grid", label: "hr.att.grid", content: () => <MonthGrid /> },
        { key: "records", label: "hr.att.records", content: () => <CrudSection config={records} /> },
        { key: "shifts", label: "hr.shifts", content: () => <CrudSection config={shifts} /> },
        { key: "settings", label: "hr.att.settings", content: () => <Settings manage={manage} /> },
      ]}
    />
  )
}

const CELL: Record<string, { code: string; cls: string }> = {
  PRESENT: { code: "P", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  ABSENT: { code: "A", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  HALF_DAY: { code: "½", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  ON_LEAVE: { code: "L", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  HOLIDAY: { code: "H", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  DAY_OFF: { code: "O", cls: "bg-muted text-muted-foreground" },
  FUTURE: { code: "", cls: "" },
  NOT_ADDED: { code: "–", cls: "text-muted-foreground" },
}

/** Monthly grid: one row per employee, one cell per day (present, absent, half day, leave, holiday, day off) + late / early / overtime marks. */
function MonthGrid() {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const now = new Date()
  const ym = searchParams.get("month") ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [year, month] = ym.split("-").map(Number)
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [state, setState] = React.useState<{ key: string; data?: AttendanceCalendar }>()
  const key = `${year}-${month}-${page}`
  React.useEffect(() => {
    let cancelled = false
    AttendanceService.calendar({ year, month, page, size: 20 })
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: Error) => {
        if (cancelled) return
        toast.error(e.message)
        setState({ key })
      })
    return () => {
      cancelled = true
    }
  }, [key, year, month, page])
  const shift = (d: number) => {
    const x = new Date(year, month - 1 + d, 1)
    update({ month: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, page: 0 })
  }
  const data = state?.key === key ? state.data : undefined
  const days = data?.rows?.[0]?.days ?? []
  const title = (c: DayCell) => [t(`hr.day.${c.status ?? "NOT_ADDED"}` as TranslationKey), c.clockIn && `${c.clockIn?.slice(0, 5)}–${c.clockOut?.slice(0, 5) ?? ""}`, c.late && t("hr.att.late"), c.earlyDeparture && t("hr.att.early"), c.overtime && t("hr.att.overtime")].filter(Boolean).join(" · ")
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("hr.prevMonth")} onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <CardTitle className="text-base" data-testid="grid-month">
            {String(month).padStart(2, "0")}/{year}
          </CardTitle>
          <Button variant="outline" size="icon" aria-label={t("hr.nextMonth")} onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(CELL)
            .filter(([, v]) => v.code && v.code !== "–")
            .map(([k, v]) => (
              <span key={k} className={`rounded px-1.5 py-0.5 ${v.cls}`}>
                {v.code} {t(`hr.day.${k}` as TranslationKey)}
              </span>
            ))}
          <span className="rounded px-1.5 py-0.5 ring-1 ring-amber-500">{t("hr.att.late")}</span>
          <span className="rounded px-1.5 py-0.5 underline decoration-sky-500">{t("hr.att.overtime")}</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {!state || state.key !== key ? (
          <Skeleton className="h-40 w-full" />
        ) : !data?.rows?.length ? (
          <p className="text-muted-foreground py-8 text-center text-sm">{t("hr.att.noEmployees")}</p>
        ) : (
          <table className="text-xs">
            <thead>
              <tr>
                <th className="bg-background sticky left-0 min-w-40 p-1 text-left">{t("hr.f.employee")}</th>
                {days.map((d) => (
                  <th key={d.date} className={`w-7 p-1 text-center font-normal ${d.weekend ? "text-muted-foreground" : ""}`}>
                    {Number(d.date?.slice(8))}
                  </th>
                ))}
                <th className="p-1 text-right">{t("hr.att.attended")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.employeeId} className="border-t">
                  <td className="bg-background sticky left-0 p-1">
                    <span className="font-medium">{r.fullName}</span>
                    <span className="text-muted-foreground block">{r.designation ?? r.employeeCode}</span>
                  </td>
                  {(r.days ?? []).map((c) => {
                    const s = CELL[c.status ?? "NOT_ADDED"] ?? CELL.NOT_ADDED
                    return (
                      <td key={c.date} className="p-0.5 text-center">
                        <span
                          title={title(c)}
                          aria-label={`${r.fullName} ${c.date}: ${title(c)}`}
                          className={`inline-flex size-6 items-center justify-center rounded ${s.cls} ${c.late || c.earlyDeparture ? "ring-1 ring-amber-500" : ""} ${c.overtime ? "underline decoration-sky-500" : ""}`}
                        >
                          {s.code}
                        </span>
                      </td>
                    )
                  })}
                  <td className="p-1 text-right font-medium">
                    {r.attended ?? 0}/{r.workingDays ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

/** Working days (weekly off days) and IP restriction (allowed IPs, one per line). */
function Settings({ manage }: { manage: boolean }) {
  const t = useT()
  const [state, setState] = React.useState<{ off: string[]; ip: boolean; ips: string }>()
  React.useEffect(() => {
    let cancelled = false
    AttendanceService.settings()
      .then((s) => !cancelled && setState({ off: s.weeklyOffDays ?? [], ip: !!s.ipRestrictionEnabled, ips: (s.allowedIps ?? []).join("\n") }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [])
  if (!state) return <Skeleton className="h-40 w-full" />
  const ips = state.ips
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  const badIp = ips.find((x) => !/^[0-9a-fA-F:.]+(\/\d{1,3})?$/.test(x))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("hr.att.workingDays")}</CardTitle>
          <CardDescription>{t("hr.att.workingDaysHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4" role="group" aria-label={t("hr.att.workingDays")}>
          {WEEK_DAYS.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={!manage} checked={state.off.includes(d)} onChange={(e) => setState({ ...state, off: e.target.checked ? [...state.off, d] : state.off.filter((x) => x !== d) })} />
              {t(`hr.weekday.${d}`)}
            </label>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("hr.att.ipRestriction")}</CardTitle>
          <CardDescription>{t("hr.att.ipHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch disabled={!manage} checked={state.ip} onCheckedChange={(c) => setState({ ...state, ip: c })} aria-label={t("hr.att.ipRestriction")} /> {t("hr.att.ipEnabled")}
          </label>
          <Textarea rows={4} disabled={!manage || !state.ip} aria-label={t("hr.att.allowedIps")} placeholder="192.168.1.10" value={state.ips} onChange={(e) => setState({ ...state, ips: e.target.value })} />
          {badIp && <p className="text-destructive text-sm">{t("hr.v.ip", { ip: badIp })}</p>}
        </CardContent>
      </Card>
      {manage && (
        <div className="lg:col-span-2">
          <Button disabled={!!badIp || (state.ip && ips.length === 0)} onClick={() => attempt(() => AttendanceService.saveSettings({ weeklyOffDays: state.off, ipRestrictionEnabled: state.ip, allowedIps: ips }), t("common.saved"))}>
            {t("common.save")}
          </Button>
        </div>
      )}
    </div>
  )
}

