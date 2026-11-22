"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Plus, Trash2, X } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useUrlQuery } from "@/hooks/use-url-query"
import { TimesheetService, type DayCell, type ETimeEntryType, type TimeEntryDto, type TimesheetMonth } from "@/lib/attendance/timesheet.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { EmployeeLookupService, type EmployeeOption } from "@/lib/meeting/zoom.service"
import { toNumber } from "@/lib/sales/sales.schema"

import { attempt, Field, today } from "../projects/_components/project-kit"

const PAGE_SIZE = 20
const ALL = "ALL"
const TYPES: ETimeEntryType[] = ["CLOCK_IN_OUT", "PROJECT", "MANUAL"]
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  REJECTED: "bg-red-500/15 text-red-700 dark:text-red-400",
}

export default function TimesheetsPage() {
  return (
    <React.Suspense>
      <Timesheets />
    </React.Suspense>
  )
}

/**
 * §11.5 timesheets: monthly grid of hours per employee per day with day and row totals; filters employee, month, year.
 * A cell opens that day's entries (approve / reject / delete); Add entry: type, employee, date, hours, minutes, notes.
 */
function Timesheets() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("ATTENDANCE_MANAGE")
  const now = new Date()
  const { searchParams, update } = useUrlQuery()
  const year = Number(searchParams.get("year") ?? now.getFullYear()) || now.getFullYear()
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1) || now.getMonth() + 1
  const employeeId = searchParams.get("employeeId") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<TimesheetMonth>()
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([])
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [adding, setAdding] = React.useState<{ employeeId?: string; date?: string; entry?: TimeEntryDto } | null>(null)
  const [day, setDay] = React.useState<{ employeeId: string; name: string; date: string }>()

  React.useEffect(() => {
    let cancelled = false
    EmployeeLookupService.employees()
      .then((p) => !cancelled && setEmployees(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    TimesheetService.month({ year, month, employeeId, page, size: PAGE_SIZE })
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [year, month, employeeId, page, reloadKey])

  const days = data?.rows?.[0]?.days?.map((d) => d.date ?? "") ?? Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)
  const hours = (n?: number) => (n ? formatNumber(n, language, 2) : "")
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.timesheets")} description={t("timesheet.subtitle")}>
        {manage && (
          <Button disabled={employees.length === 0} onClick={() => setAdding({})}>
            <Plus className="size-4" /> {t("timesheet.add")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={employeeId ?? ALL} onValueChange={(v) => update({ employeeId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-52" aria-label={t("timesheet.employee")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("timesheet.allEmployees")}</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id ?? ""}>
                    {e.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(month)} onValueChange={(v) => update({ month: v, page: 0 })}>
              <SelectTrigger className="w-36" aria-label={t("timesheet.month")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {new Date(2000, m - 1, 1).toLocaleDateString(language === "vi" ? "vi-VN" : language === "ko" ? "ko-KR" : "en-US", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => update({ year: v, page: 0 })}>
              <SelectTrigger className="w-28" aria-label={t("crm.year")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2].map((d) => (
                  <SelectItem key={d} value={String(now.getFullYear() - d)}>
                    {now.getFullYear() - d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data?.counts && (
              <div className="text-muted-foreground ml-auto flex gap-3 text-xs">
                <span>{t("timesheet.pending", { n: data.counts.pending ?? 0 })}</span>
                <span>{t("timesheet.approved", { n: data.counts.approved ?? 0 })}</span>
                <span>{t("timesheet.rejected", { n: data.counts.rejected ?? 0 })}</span>
              </div>
            )}
          </div>
          {!data ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="bg-muted/50 sticky left-0 z-10 min-w-44 border-r p-2 text-left font-medium">{t("timesheet.employee")}</th>
                    {days.map((d) => {
                      const dt = new Date(d)
                      const weekend = dt.getDay() === 0 || dt.getDay() === 6
                      return (
                        <th key={d} className={`w-9 border-r p-1 text-center font-medium ${weekend ? "text-muted-foreground" : ""}`}>
                          {Number(d.slice(8, 10))}
                        </th>
                      )
                    })}
                    <th className="p-2 text-right font-medium">{t("sales.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rows ?? []).length === 0 && (
                    <tr>
                      <td colSpan={days.length + 2} className="text-muted-foreground h-20 text-center">
                        {t(employees.length === 0 ? "timesheet.noEmployees" : "timesheet.empty")}
                      </td>
                    </tr>
                  )}
                  {(data.rows ?? []).map((r) => (
                    <tr key={r.employeeId} className="border-t">
                      <td className="bg-background sticky left-0 z-10 border-r p-2">
                        <div className="font-medium">{r.fullName}</div>
                        {r.designation && <div className="text-muted-foreground">{r.designation}</div>}
                      </td>
                      {(r.days ?? []).map((c: DayCell) => (
                        <td key={c.date} className="border-r p-0 text-center">
                          <button
                            type="button"
                            className={`h-9 w-full ${c.status ? STATUS_CLASS[c.status] : "hover:bg-muted"}`}
                            aria-label={t("timesheet.cell", { name: r.fullName ?? "", date: c.date ?? "" })}
                            onClick={() =>
                              c.entries
                                ? setDay({ employeeId: r.employeeId ?? "", name: r.fullName ?? "", date: c.date ?? "" })
                                : manage && setAdding({ employeeId: r.employeeId, date: c.date })
                            }
                          >
                            {hours(c.hours)}
                          </button>
                        </td>
                      ))}
                      <td className="p-2 text-right font-semibold">{formatNumber(r.total, language, 2)}</td>
                    </tr>
                  ))}
                </tbody>
                {(data.rows ?? []).length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 border-t font-semibold">
                      <td className="bg-muted/50 sticky left-0 border-r p-2">{t("timesheet.dayTotal")}</td>
                      {(data.dayTotals ?? []).map((h, i) => (
                        <td key={i} className="border-r p-1 text-center">
                          {hours(h)}
                        </td>
                      ))}
                      <td className="p-2 text-right" data-testid="timesheet-total">
                        {formatNumber(data.total, language, 2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={Math.ceil((data?.totalElements ?? 0) / PAGE_SIZE)} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>

      <EntryDialog state={adding} employees={employees} onClose={() => setAdding(null)} onSaved={reload} />
      <DayDialog day={day} manage={manage} onClose={() => setDay(undefined)} onEdit={(entry) => setAdding({ entry })} onChanged={reload} />
    </div>
  )
}

type T = ReturnType<typeof useT>
// Limits from attendance-service TimesheetDtos.EntryForm: hours 0..24 + minutes 0..59, 15 min to 24 h in all (ATT_053,
// ATT_031); description required ≤ 1000, project ≤ 150.
const entrySchema = (t: T) =>
  z
    .object({
      type: z.enum(["CLOCK_IN_OUT", "PROJECT", "MANUAL"]),
      employeeId: z.string().min(1, t("timesheet.v.employee")),
      date: z.string().min(1, t("sales.v.date")),
      hours: z.string(),
      minutes: z.string(),
      project: z.string().max(150, t("sales.v.max", { n: 150 })),
      description: z.string().trim().min(1, t("project.v.required")).max(1000, t("sales.v.max", { n: 1000 })),
    })
    .superRefine((v, ctx) => {
      const h = v.hours.trim() === "" ? 0 : toNumber(v.hours)
      const m = v.minutes.trim() === "" ? 0 : Number(v.minutes)
      if (!(h >= 0 && h <= 24)) return ctx.addIssue({ code: "custom", path: ["hours"], message: t("timesheet.v.hours") })
      if (!(Number.isInteger(m) && m >= 0 && m <= 59)) return ctx.addIssue({ code: "custom", path: ["minutes"], message: t("timesheet.v.minutes") })
      const total = h * 60 + m
      if (total < 15 || total > 24 * 60) ctx.addIssue({ code: "custom", path: ["hours"], message: t("timesheet.v.total") })
    })
type TEntry = z.infer<ReturnType<typeof entrySchema>>

function EntryDialog({
  state,
  employees,
  onClose,
  onSaved,
}: {
  state: { employeeId?: string; date?: string; entry?: TimeEntryDto } | null
  employees: EmployeeOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const e = state?.entry
  const values = React.useMemo<TEntry>(() => {
    const total = Math.round((e?.hours ?? 0) * 60)
    return {
      type: e?.type ?? "MANUAL",
      employeeId: e?.employeeId ?? state?.employeeId ?? "",
      date: e?.date ?? state?.date ?? today(),
      hours: e ? String(Math.floor(total / 60)) : "8",
      minutes: e ? String(total % 60) : "0",
      project: e?.project ?? "",
      description: e?.description ?? "",
    }
  }, [e, state])
  const form = useForm<TEntry>({ resolver: zodResolver(entrySchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const type = useWatch({ control: form.control, name: "type" })
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            const body = {
              employeeId: Number(v.employeeId),
              date: v.date,
              hours: v.hours.trim() === "" ? 0 : toNumber(v.hours),
              minutes: v.minutes.trim() === "" ? 0 : Number(v.minutes),
              type: v.type,
              project: v.type === "PROJECT" ? v.project.trim() || null : null,
              description: v.description.trim(),
            }
            if (await attempt(() => (e?.id ? TimesheetService.update(e.id, body) : TimesheetService.create(body)), t("common.saved"))) {
              onSaved()
              onClose()
            }
          })}
        >
          <DialogHeader>
            <DialogTitle>{t(e ? "timesheet.edit" : "timesheet.add")}</DialogTitle>
            <DialogDescription>{t("timesheet.formDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field id="ts-type" label={t("timesheet.type")}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ts-type" className="w-full" aria-label={t("timesheet.type")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((x) => (
                        <SelectItem key={x} value={x}>
                          {t(`timesheet.typeOf.${x}` as TranslationKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="ts-employee" label={t("timesheet.employee")} error={errors.employeeId?.message}>
              <Controller
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!e}>
                    <SelectTrigger id="ts-employee" className="w-full" aria-label={t("timesheet.employee")}>
                      <SelectValue placeholder={t("sales.choose")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((x) => (
                        <SelectItem key={x.id} value={x.id ?? ""}>
                          {x.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="ts-date" label={t("pos.date")} error={errors.date?.message}>
              <Input id="ts-date" type="date" {...form.register("date")} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field id="ts-hours" label={t("timesheet.hours")} error={errors.hours?.message}>
                <Input id="ts-hours" inputMode="decimal" {...form.register("hours")} />
              </Field>
              <Field id="ts-minutes" label={t("timesheet.minutes")} error={errors.minutes?.message}>
                <Input id="ts-minutes" inputMode="numeric" {...form.register("minutes")} />
              </Field>
            </div>
          </div>
          {type === "PROJECT" && (
            <Field id="ts-project" label={t("timesheet.project")} error={errors.project?.message}>
              <Input id="ts-project" {...form.register("project")} />
            </Field>
          )}
          <Field id="ts-desc" label={t("timesheet.notes")} error={errors.description?.message}>
            <Textarea id="ts-desc" rows={2} {...form.register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Entries of one employee's day: approve / reject pending ones, edit pending or rejected ones, delete. */
function DayDialog({
  day,
  manage,
  onClose,
  onEdit,
  onChanged,
}: {
  day?: { employeeId: string; name: string; date: string }
  manage: boolean
  onClose: () => void
  onEdit: (e: TimeEntryDto) => void
  onChanged: () => void
}) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [entries, setEntries] = React.useState<{ key: string; list: TimeEntryDto[] }>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const key = day ? `${day.employeeId}|${day.date}` : ""
  React.useEffect(() => {
    if (!key) return
    let cancelled = false
    const [emp, date] = key.split("|")
    TimesheetService.entries(emp, date)
      .then((list) => !cancelled && setEntries({ key, list: list ?? [] }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [key, reloadKey])
  const list = entries?.key === key ? entries.list : undefined
  const act = async (fn: () => Promise<unknown>) => {
    if (await attempt(fn, t("common.saved"))) {
      setReloadKey((x) => x + 1)
      onChanged()
    }
  }
  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("timesheet.dayTitle", { name: day?.name ?? "", date: day?.date ?? "" })}</DialogTitle>
          <DialogDescription className="sr-only">{t("menu.timesheets")}</DialogDescription>
        </DialogHeader>
        {!list ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="grid gap-2">
            {list.map((e) => (
              <li key={e.id} className="grid gap-1 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatNumber(e.hours, language, 2)} h · {e.type ? t(`timesheet.typeOf.${e.type}` as TranslationKey) : ""}
                    {e.project ? ` · ${e.project}` : ""}
                  </span>
                  <Badge variant="outline" className={e.status ? STATUS_CLASS[e.status] : ""}>
                    {e.status ? t(`timesheet.status.${e.status}` as TranslationKey) : "-"}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{e.description}</p>
                {e.managerComments && <p className="text-xs">{e.managerComments}</p>}
                {manage && (
                  <div className="flex flex-wrap justify-end gap-1">
                    {e.status === "PENDING" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => act(() => TimesheetService.approve(e.id!))}>
                          <Check className="size-4" /> {t("sales.action.approve")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => act(() => TimesheetService.reject(e.id!))}>
                          <X className="size-4" /> {t("sales.action.reject")}
                        </Button>
                      </>
                    )}
                    {e.status !== "APPROVED" && (
                      <Button size="sm" variant="ghost" onClick={() => (onClose(), onEdit(e))}>
                        {t("common.edit")}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label={t("crm.deleteNamed", { name: e.description ?? "" })} onClick={() => act(() => TimesheetService.remove(e.id!))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
