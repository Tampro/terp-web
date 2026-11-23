"use client"

import * as React from "react"
import { Download, Check, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUrlQuery } from "@/hooks/use-url-query"
import { request, withQuery } from "@/lib/api"
import { HR, HrOptions, LeaveService, type BalancePage, type Row } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { saveBlob } from "@/lib/pos/pos.service"

import { attempt, CrudSection, errorMessage, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../_components/crud-kit"

const hex = /^#[0-9A-Fa-f]{6}$/
const endAfterStart = (v: Record<string, unknown>) => (v.startDate && v.endDate && String(v.endDate) < String(v.startDate) ? ("hr.v.endAfterStart" as const) : undefined)

export default function LeavePage() {
  return (
    <React.Suspense>
      <Leave />
    </React.Suspense>
  )
}

/** §15 leave: applications (Pending → Approved / Rejected with a comment), balances, types, policies, holidays. */
function Leave() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const perms = useAuthStore((s) => s.me?.permissions) ?? []
  const manage = perms.includes("LEAVE_MANAGE")
  const org = perms.includes("ORG_MANAGE")
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const leaveTypes = toSelect(useOptions("leaveTypes", HrOptions.leaveTypes))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const holidayCategories = toSelect(useOptions("holidayCategories", HrOptions.holidayCategories))
  const status = (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) }))
  const comment: FieldDef[] = [{ name: "comments", label: "hr.f.comment", type: "textarea", max: 1000 }]
  const pending = (r: Row) => r.status === "PENDING"

  const applications: CrudConfig = {
    id: "applications",
    load: HR.leaveApplications.list,
    keyword: true,
    statuses: ["PENDING", "APPROVED", "REJECTED"],
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.leaveType", render: (r) => <LeaveTypeChip name={pick(r, "leaveType.name")} color={pick(r, "leaveType.color")} /> },
      { label: "hr.f.period", render: (r) => `${formatDate(String(r.startDate ?? ""), language)} → ${formatDate(String(r.endDate ?? ""), language)}` },
      { label: "hr.f.days", path: "days" },
      { label: "hr.f.reason", render: (r) => <span className="line-clamp-2 max-w-64">{String(r.reason ?? "-")}</span> },
      {
        label: "hr.f.attachment",
        render: (r) =>
          r.attachmentUrl ? (
            <a href={String(r.attachmentUrl)} target="_blank" rel="noopener noreferrer" className="underline">
              {String(r.attachmentName ?? t("hr.open"))}
            </a>
          ) : (
            "-"
          ),
      },
      { label: "hr.f.status", render: (r) => <StatusWithComment row={r} /> },
    ],
    rowName: (r) => `${pick(r, "employee.fullName") ?? ""} (${pick(r, "leaveType.name") ?? ""})`,
    createLabel: "hr.leave.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "leaveTypeId", label: "hr.f.leaveType", type: "select", required: true, numeric: true, options: leaveTypes },
      { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
      { name: "endDate", label: "hr.f.endDate", type: "date", required: true, check: endAfterStart },
      { name: "reason", label: "hr.f.reason", type: "textarea", required: true, max: 1000 },
      { name: "attachmentFileId", label: "hr.f.attachment", type: "file", full: true },
    ],
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), leaveTypeId: pick(r, "leaveType.id"), attachmentFileId__name: r.attachmentName }),
    save: HR.leaveApplications.save,
    remove: HR.leaveApplications.remove,
    canEdit: pending,
    canDelete: pending,
    actions: [
      { key: "approve", label: "hr.approve", icon: <Check className="size-4" />, when: pending, fields: comment, run: (r, b) => HR.leaveApplications.put(r.id ?? "", "approve", b) },
      { key: "reject", label: "hr.reject", icon: <X className="size-4" />, when: pending, fields: comment, destructive: true, run: (r, b) => HR.leaveApplications.put(r.id ?? "", "reject", b) },
    ],
    manage,
  }
  const types: CrudConfig = {
    id: "leave-types",
    load: HR.leaveTypes.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.color", path: "color", kind: "color" },
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.maxDaysPerYear", path: "maxDaysPerYear" },
      { label: "hr.f.paid", path: "paid", kind: "bool" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.leaveType.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "maxDaysPerYear", label: "hr.f.maxDaysPerYear", type: "number", required: true, min: 0, max: 366 },
      { name: "color", label: "hr.f.color", type: "color", pattern: hex },
      { name: "status", label: "hr.f.status", type: "select", options: status },
      { name: "paid", label: "hr.f.paid", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE", paid: true },
    save: HR.leaveTypes.save,
    remove: HR.leaveTypes.remove,
    invalidates: true,
    manage,
  }
  const policies: CrudConfig = {
    id: "leave-policies",
    load: HR.leavePolicies.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.leaveType", path: "leaveType.name" },
      { label: "hr.f.daysPerApplication", render: (r) => `${r.minDaysPerApplication ?? "-"}–${r.maxDaysPerApplication ?? "-"}` },
      { label: "hr.f.carryForward", path: "carryForwardLimit" },
      { label: "hr.f.requiresApproval", path: "requiresApproval", kind: "bool" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.leavePolicy.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "leaveTypeId", label: "hr.f.leaveType", type: "select", required: true, numeric: true, options: leaveTypes },
      { name: "minDaysPerApplication", label: "hr.f.minDays", type: "number", required: true, min: 1, max: 366 },
      { name: "maxDaysPerApplication", label: "hr.f.maxDays", type: "number", required: true, min: 1, max: 366, check: (v) => (Number(v.maxDaysPerApplication) < Number(v.minDaysPerApplication) ? "hr.v.maxAboveMin" : undefined) },
      { name: "carryForwardLimit", label: "hr.f.carryForward", type: "number", min: 0, max: 366 },
      { name: "status", label: "hr.f.status", type: "select", options: status },
      { name: "requiresApproval", label: "hr.f.requiresApproval", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE", requiresApproval: true, minDaysPerApplication: "1", maxDaysPerApplication: "30" },
    toValues: (r) => ({ ...r, leaveTypeId: pick(r, "leaveType.id") }),
    save: HR.leavePolicies.save,
    remove: HR.leavePolicies.remove,
    manage,
  }
  const holidays: CrudConfig = {
    id: "holidays",
    load: HR.holidays.list,
    keyword: true,
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.category", render: (r) => <LeaveTypeChip name={pick(r, "category.name")} color={pick(r, "category.color")} /> },
      { label: "hr.f.period", render: (r) => `${formatDate(String(r.startDate ?? ""), language)} → ${formatDate(String(r.endDate ?? ""), language)}` },
      { label: "hr.f.days", path: "days" },
      { label: "hr.f.paid", path: "isPaid", kind: "bool" },
      { label: "hr.f.calendarSync", path: "calendarSync", kind: "bool" },
      { label: "hr.f.branches", render: (r) => (r.allBranches ? t("hr.allBranches") : ((r.branches as { name?: string }[] | undefined) ?? []).map((b) => b.name).join(", ") || "-") },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.holiday.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "categoryId", label: "hr.f.category", type: "select", required: true, numeric: true, options: holidayCategories },
      { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
      { name: "endDate", label: "hr.f.endDate", type: "date", required: true, check: endAfterStart },
      { name: "isPaid", label: "hr.f.paid", type: "switch" },
      // employee-service HolidayForm.calendarSync: created / updated / deleted on the company's Google Calendar
      // (notification-service, Google Calendar integration on); omitted = false
      { name: "calendarSync", label: "hr.f.calendarSync", type: "switch" },
      { name: "branchIds", label: "hr.f.branchesHint", type: "multi", options: branches },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
    ],
    defaults: { isPaid: true },
    toValues: (r) => ({ ...r, categoryId: pick(r, "category.id"), branchIds: ((r.branches as { id?: string }[] | undefined) ?? []).map((b) => b.id) }),
    save: HR.holidays.save,
    remove: HR.holidays.remove,
    manage: org,
    toolbar: (
      <Button
        variant="outline"
        onClick={async () => {
          try {
            saveBlob(await request<Blob>(withQuery("/v1/org/holidays/export/ical", { year: new Date().getFullYear() }), { as: "blob" }), `holidays-${new Date().getFullYear()}.ics`)
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      >
        <Download className="size-4" /> {t("hr.holiday.ical")}
      </Button>
    ),
  }
  return (
    <TabbedPage
      title={t("menu.hr.leave")}
      description={t("hr.leave.subtitle")}
      tabs={[
        { key: "applications", label: "hr.leave.applications", content: () => <CrudSection config={applications} /> },
        { key: "balances", label: "hr.leave.balances", content: () => <Balances manage={manage} /> },
        { key: "types", label: "hr.leave.types", content: () => <CrudSection config={types} /> },
        { key: "policies", label: "hr.leave.policies", content: () => <CrudSection config={policies} /> },
        { key: "holidays", label: "hr.holidays", content: () => <CrudSection config={holidays} /> },
      ]}
    />
  )
}

function LeaveTypeChip({ name, color }: { name: unknown; color: unknown }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: String(color ?? "#999") }} />
      {String(name ?? "-")}
    </span>
  )
}

function StatusWithComment({ row }: { row: Row }) {
  const t = useT()
  const v = row.status
  return (
    <div className="grid gap-0.5">
      <span>{v ? t(`hr.status.${String(v)}` as "hr.status.PENDING") : "-"}</span>
      {!!row.managerComments && <span className="text-muted-foreground text-xs">{String(row.managerComments)}</span>}
    </div>
  )
}

/** Balances per employee and leave type: total (allocated + carried forward + adjustment), used, available; Sync recomputes the year. */
function Balances({ manage }: { manage: boolean }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update } = useUrlQuery()
  const year = Number(searchParams.get("year") ?? new Date().getFullYear())
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [reload, setReload] = React.useState(0)
  const [state, setState] = React.useState<{ key: string; data?: BalancePage }>()
  const key = `${year}-${page}-${reload}`
  React.useEffect(() => {
    let cancelled = false
    LeaveService.balances({ year, page, size: 20 })
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: Error) => {
        if (cancelled) return
        toast.error(e.message)
        setState({ key })
      })
    return () => {
      cancelled = true
    }
  }, [key, year, page])
  const data = state?.key === key ? state.data : undefined
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input type="number" className="w-28" aria-label={t("hr.year")} value={year} onChange={(e) => update({ year: e.target.value, page: 0 })} />
          <span className="text-muted-foreground text-sm">{data?.lastSyncedAt ? t("hr.leave.lastSynced", { at: formatDate(data.lastSyncedAt, language) }) : t("hr.leave.neverSynced")}</span>
          {manage && (
            <Button variant="outline" onClick={async () => (await attempt(() => LeaveService.sync(year), t("common.saved"))) && setReload((x) => x + 1)}>
              <RefreshCw className="size-4" /> {t("hr.leave.sync")}
            </Button>
          )}
        </div>
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : !data.cards?.length ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t("hr.leave.noBalances")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hr.f.employee")}</TableHead>
                  <TableHead>{t("hr.f.leaveType")}</TableHead>
                  <TableHead className="text-right">{t("hr.leave.total")}</TableHead>
                  <TableHead className="text-right">{t("hr.leave.used")}</TableHead>
                  <TableHead className="text-right">{t("hr.leave.available")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cards.flatMap((c) =>
                  (c.balances ?? []).map((b, i) => (
                    <TableRow key={`${c.employee?.id}-${b.leaveType?.id}`}>
                      <TableCell>{i === 0 ? c.employee?.fullName : ""}</TableCell>
                      <TableCell>
                        <LeaveTypeChip name={b.leaveType?.name} color={b.leaveType?.color} />
                      </TableCell>
                      <TableCell className="text-right">{b.total ?? 0}</TableCell>
                      <TableCell className="text-right">{b.used ?? 0}</TableCell>
                      <TableCell className={`text-right font-medium ${(b.available ?? 0) < 0 ? "text-destructive" : ""}`}>{b.available ?? 0}</TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {!!data?.totalElements && <Pager page={data.page ?? page} size={data.size ?? 20} total={data.totalElements} totalPages={Math.ceil(data.totalElements / (data.size ?? 20))} onPage={(p) => update({ page: p })} />}
      </CardContent>
    </Card>
  )
}
