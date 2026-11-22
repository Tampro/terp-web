"use client"

import * as React from "react"
import { Ban, Banknote, Cog, Download, FileText, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { request, withQuery, type IPage } from "@/lib/api"
import { HR, HrOptions, PayrollService, type Option, type PayrollEntry, type Row } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { saveBlob } from "@/lib/pos/pos.service"

import { attempt, CrudSection, errorMessage, FormDialogBody, HrStatus, initialValues, PlainSelect, pick, TabbedPage, toSelect, today, useAuthStore, useOptions, type CrudConfig, type FieldDef, type RowAction } from "../_components/crud-kit"

const FREQUENCIES = ["MONTHLY", "SEMI_MONTHLY", "BI_WEEKLY", "WEEKLY"] as const
const bankOptions = () =>
  request<IPage<{ id?: string; bankName?: string; accountNumber?: string }>>(withQuery("/v1/accounting/bank-accounts", { active: true, size: 100 })).then((p) =>
    (p.content ?? []).map((b): Option => ({ id: b.id, name: `${b.bankName ?? ""} · ${b.accountNumber ?? ""}` })),
  )

export default function PayrollPage() {
  return (
    <React.Suspense>
      <Payroll />
    </React.Suspense>
  )
}

/** §15 payroll: runs (Draft → Completed, paid / unpaid, payslips), set salary (basic, allowances, deductions, overtimes, loans), payslips, salary components. */
function Payroll() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const perms = useAuthStore((s) => s.me?.permissions) ?? []
  const manage = perms.includes("PAYROLL_MANAGE")
  const canPay = perms.includes("PAYROLL_PAY")
  const banks = toSelect(useOptions("bankAccounts", bankOptions))
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const [viewRun, setViewRun] = React.useState<Row>()
  const [salary, setSalary] = React.useState<{ row?: Row } | null>(null)
  const [salaryReload, setSalaryReload] = React.useState(0)
  const draft = (r: Row) => r.status === "DRAFT"
  const completed = (r: Row) => r.status === "COMPLETED"

  const runs: CrudConfig = {
    id: "runs",
    load: HR.runs.list,
    keyword: true,
    statuses: ["DRAFT", "PROCESSING", "COMPLETED", "CANCELLED"],
    onRowClick: setViewRun,
    columns: [
      { label: "hr.f.title", path: "title" },
      { label: "hr.f.frequency", render: (r) => t(`hr.freq.${String(r.frequency)}` as TranslationKey) },
      { label: "hr.f.period", render: (r) => `${formatDate(String(r.periodStart ?? ""), language)} → ${formatDate(String(r.periodEnd ?? ""), language)}` },
      { label: "hr.f.payDate", path: "payDate", kind: "date" },
      { label: "hr.employees", path: "employeeCount" },
      { label: "hr.pay.gross", path: "grossPay", kind: "money" },
      { label: "hr.pay.net", path: "netPay", kind: "money" },
      { label: "hr.f.status", path: "status", kind: "status" },
      { label: "hr.pay.payment", path: "paymentStatus", kind: "status" },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "hr.run.create",
    fields: [
      { name: "title", label: "hr.f.title", required: true, max: 200, full: true },
      { name: "frequency", label: "hr.f.frequency", type: "select", required: true, options: FREQUENCIES.map((f) => ({ value: f, label: t(`hr.freq.${f}`) })) },
      { name: "payDate", label: "hr.f.payDate", type: "date", required: true, check: (v) => (v.payDate && v.periodStart && String(v.payDate) < String(v.periodStart) ? "hr.v.payDate" : undefined) },
      { name: "periodStart", label: "hr.f.periodStart", type: "date", required: true },
      { name: "periodEnd", label: "hr.f.periodEnd", type: "date", required: true, check: (v) => (v.periodStart && v.periodEnd && String(v.periodEnd) < String(v.periodStart) ? "hr.v.endAfterStart" : undefined) },
      { name: "bankAccountId", label: "hr.f.bankAccount", type: "select", numeric: true, none: true, options: banks, full: true },
      { name: "notes", label: "hr.f.notes", type: "textarea", max: 1000 },
    ],
    defaults: { frequency: "MONTHLY" },
    save: HR.runs.save,
    remove: HR.runs.remove,
    canEdit: draft,
    canDelete: draft,
    actions: [
      { key: "process", label: "hr.run.process", icon: <Cog className="size-4" />, when: draft, confirmDesc: "hr.run.processDesc", run: (r) => PayrollService.process(r.id ?? "") },
      ...(canPay
        ? ([
            {
              key: "pay",
              label: "hr.run.pay",
              icon: <Banknote className="size-4" />,
              when: (r: Row) => completed(r) && r.paymentStatus !== "PAID",
              confirmDesc: "hr.run.payDesc",
              fields: [
                { name: "bankAccountId", label: "hr.f.bankAccount", type: "select", numeric: true, options: banks },
                { name: "paymentDate", label: "hr.f.paymentDate", type: "date" },
              ] satisfies FieldDef[],
              run: (r: Row, b: Record<string, unknown>) => PayrollService.pay(r.id ?? "", b),
            },
          ] satisfies RowAction[])
        : []),
      { key: "payslips", label: "hr.run.payslips", icon: <FileText className="size-4" />, when: completed, confirmDesc: "hr.run.payslipsDesc", run: (r) => PayrollService.generatePayslips(r.id ?? "") },
      { key: "cancel", label: "hr.run.cancel", icon: <Ban className="size-4" />, when: (r) => draft(r) || completed(r), confirmDesc: "hr.run.cancelDesc", destructive: true, run: (r) => PayrollService.cancel(r.id ?? "") },
    ],
    manage,
  }
  const salaries: CrudConfig = {
    id: "salaries",
    load: HR.salaries.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    reloadKey: salaryReload,
    // the list carries no structure (component lines): open the full record
    onRowClick: (r) =>
      HR.salaries
        .get(r.id ?? "")
        .then((full) => setSalary({ row: full }))
        .catch((e: Error) => toast.error(e.message)),
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.basicSalary", path: "basicSalary", kind: "money" },
      { label: "hr.pay.earnings", path: "structure.totalEarnings", kind: "money" },
      { label: "hr.pay.deductions", path: "structure.totalDeductions", kind: "money" },
      { label: "hr.pay.net", path: "structure.net", kind: "money" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(pick(r, "employee.fullName") ?? ""),
    remove: HR.salaries.remove,
    manage,
    toolbar: manage ? (
      <Button onClick={() => setSalary({})}>
        <Plus className="size-4" /> {t("hr.salary.create")}
      </Button>
    ) : undefined,
  }
  const payslips: CrudConfig = {
    id: "payslips",
    load: HR.payslips.list,
    keyword: true,
    statuses: ["GENERATED", "DOWNLOADED"],
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.run", path: "runTitle" },
      { label: "hr.f.period", render: (r) => `${formatDate(String(r.periodStart ?? ""), language)} → ${formatDate(String(r.periodEnd ?? ""), language)}` },
      { label: "hr.f.payDate", path: "payDate", kind: "date" },
      { label: "hr.pay.net", path: "netPay", kind: "money" },
      { label: "hr.f.status", path: "status", kind: "status" },
      {
        label: "hr.pay.payslip",
        render: (r) => (
          <Button
            variant="outline"
            size="sm"
            aria-label={t("hr.pay.downloadFor", { name: String(pick(r, "employee.fullName") ?? "") })}
            onClick={async () => {
              try {
                saveBlob(await PayrollService.payslipPdf(r.id ?? ""), `payslip-${String(pick(r, "employee.employeeNo") ?? r.id)}-${String(r.payDate ?? "")}.pdf`)
              } catch (e) {
                toast.error(errorMessage(e))
              }
            }}
          >
            <Download className="size-4" /> PDF
          </Button>
        ),
      },
    ],
    rowName: (r) => String(pick(r, "employee.fullName") ?? ""),
    manage: false,
  }
  const components: CrudConfig = {
    id: "components",
    load: HR.components.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "le.type", render: (r) => t(`hr.comp.${String(r.type)}` as TranslationKey) },
      { label: "hr.f.calculation", render: (r) => t(`hr.calc.${String(r.calculation)}` as TranslationKey) },
      { label: "hr.f.value", render: (r) => (r.calculation === "PERCENTAGE" ? `${String(r.value)}%` : money(r.value as number)) },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.component.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "type", label: "le.type", type: "select", required: true, options: (["EARNING", "DEDUCTION"] as const).map((x) => ({ value: x, label: t(`hr.comp.${x}`) })) },
      { name: "calculation", label: "hr.f.calculation", type: "select", required: true, options: (["FIXED", "PERCENTAGE"] as const).map((x) => ({ value: x, label: t(`hr.calc.${x}`) })) },
      { name: "value", label: "hr.f.value", type: "number", required: true, min: 0, check: (v) => (v.calculation === "PERCENTAGE" && Number(v.value) > 100 ? "hr.v.percent" : undefined) },
      { name: "status", label: "hr.f.status", type: "select", options: (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
    ],
    defaults: { type: "EARNING", calculation: "FIXED", status: "ACTIVE" },
    save: HR.components.save,
    remove: HR.components.remove,
    invalidates: true,
    manage,
  }
  return (
    <>
      <TabbedPage
        title={t("menu.hr.payroll")}
        description={t("hr.pay.subtitle")}
        tabs={[
          { key: "runs", label: "hr.pay.runs", content: () => <CrudSection config={runs} /> },
          { key: "salaries", label: "hr.pay.setSalary", content: () => <CrudSection config={salaries} /> },
          { key: "payslips", label: "hr.pay.payslips", content: () => <CrudSection config={payslips} /> },
          { key: "components", label: "hr.pay.components", content: () => <CrudSection config={components} /> },
        ]}
      />
      <Dialog open={!!viewRun} onOpenChange={(o) => !o && setViewRun(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">{viewRun && <RunEntries run={viewRun} />}</DialogContent>
      </Dialog>
      <Dialog open={!!salary} onOpenChange={(o) => !o && setSalary(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {salary && <SalaryEditor key={salary.row?.id ?? "new"} row={salary.row} employees={employees} manage={manage} onSaved={() => setSalaryReload((x) => x + 1)} onClose={() => setSalary(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Per-employee pay of one run: basic, allowances, manual and attendance overtime, deductions (LOP, unpaid leave, loans), gross, net. */
function RunEntries({ run }: { run: Row }) {
  const t = useT()
  const money = useMoney()
  const [entries, setEntries] = React.useState<PayrollEntry[]>()
  React.useEffect(() => {
    let cancelled = false
    PayrollService.entries(run.id ?? "")
      .then((e) => !cancelled && setEntries(e ?? []))
      .catch((e: Error) => {
        if (cancelled) return
        toast.error(e.message)
        setEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [run.id])
  const sum = (k: keyof PayrollEntry) => (entries ?? []).reduce((s, e) => s + Number(e[k] ?? 0), 0)
  // the entries list carries no lines: totalEarnings = basic salary + earning components
  const allowances = (e: PayrollEntry) =>
    e.lines ? e.lines.filter((l) => l.type === "EARNING").reduce((s, l) => s + (l.amount ?? 0), 0) : Math.max(0, (e.totalEarnings ?? 0) - (e.basicSalary ?? 0))
  return (
    <>
      <DialogHeader>
        <DialogTitle>{String(run.title ?? "")}</DialogTitle>
        <DialogDescription>
          <HrStatus status={run.status} /> <HrStatus status={run.paymentStatus} />
        </DialogDescription>
      </DialogHeader>
      {!entries ? (
        <Skeleton className="h-40 w-full" />
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t("hr.run.noEntries")}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("hr.f.employee")}</TableHead>
                <TableHead className="text-right">{t("hr.f.basicSalary")}</TableHead>
                <TableHead className="text-right">{t("hr.pay.allowances")}</TableHead>
                <TableHead className="text-right">{t("hr.pay.overtimeManual")}</TableHead>
                <TableHead className="text-right">{t("hr.pay.overtimeAttendance")}</TableHead>
                <TableHead className="text-right">{t("hr.pay.deductions")}</TableHead>
                <TableHead className="text-right">{t("hr.pay.loans")}</TableHead>
                <TableHead className="text-right">{t("hr.pay.gross")}</TableHead>
                <TableHead className="text-right">{t("hr.pay.net")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {e.employee?.fullName}
                    <span className="text-muted-foreground block text-xs">{t("hr.pay.daysLine", { p: e.presentDays ?? 0, w: e.workingDays ?? 0, l: e.unpaidLeaveDays ?? 0 })}</span>
                  </TableCell>
                  <TableCell className="text-right">{money(e.basicSalary)}</TableCell>
                  <TableCell className="text-right">{money(allowances(e))}</TableCell>
                  <TableCell className="text-right">{money(e.manualOvertimeAmount)}</TableCell>
                  <TableCell className="text-right">{money(e.overtimeAmount)}</TableCell>
                  <TableCell className="text-right">{money(e.totalDeductions)}</TableCell>
                  <TableCell className="text-right">{money(e.loanDeduction)}</TableCell>
                  <TableCell className="text-right">{money(e.grossPay)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(e.netPay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t("sales.total")}</TableCell>
                <TableCell className="text-right">{money(sum("basicSalary"))}</TableCell>
                <TableCell />
                <TableCell className="text-right">{money(sum("manualOvertimeAmount"))}</TableCell>
                <TableCell className="text-right">{money(sum("overtimeAmount"))}</TableCell>
                <TableCell className="text-right">{money(sum("totalDeductions"))}</TableCell>
                <TableCell className="text-right">{money(sum("loanDeduction"))}</TableCell>
                <TableCell className="text-right">{money(sum("grossPay"))}</TableCell>
                <TableCell className="text-right font-semibold" data-testid="run-net">
                  {money(sum("netPay"))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  )
}

type Line = { key: number; componentId: string; value: string }
let lineKey = 0

/** Set salary: basic salary + allowance / deduction components (SalaryForm), then the employee's overtimes and loans. */
function SalaryEditor({ row, employees, manage, onSaved, onClose }: { row?: Row; employees: { value: string; label: string }[]; manage: boolean; onSaved: () => void; onClose: () => void }) {
  const t = useT()
  const money = useMoney()
  const components = useOptions("components", HrOptions.components)
  const [employeeId, setEmployeeId] = React.useState(String(pick(row, "employee.id") ?? ""))
  const [basic, setBasic] = React.useState(row?.basicSalary != null ? String(row.basicSalary) : "")
  const [status, setStatus] = React.useState(String(row?.status ?? "ACTIVE"))
  const [notes, setNotes] = React.useState(String(row?.notes ?? ""))
  const [lines, setLines] = React.useState<Line[]>(() => ((pick(row, "structure.lines") as { componentId?: string | number; value?: number }[] | undefined) ?? []).map((l) => ({ key: ++lineKey, componentId: String(l.componentId ?? ""), value: String(l.value ?? "") })))
  const [id, setId] = React.useState(row?.id)
  const compLabel = (o: Option) => `${o.name ?? ""} (${t(`hr.comp.${String(o.type)}` as TranslationKey)}, ${o.calculation === "PERCENTAGE" ? `${String(o.value)}%` : money(o.value as number)})`
  const dup = new Set(lines.map((l) => l.componentId)).size !== lines.length
  const valid = !!employeeId && Number(basic) >= 0 && basic !== "" && lines.every((l) => l.componentId) && !dup
  return (
    <>
      <DialogHeader>
        <DialogTitle>{row ? t("hr.salary.edit", { name: String(pick(row, "employee.fullName") ?? "") }) : t("hr.salary.create")}</DialogTitle>
        <DialogDescription>{t("hr.salary.hint")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <PlainSelect label={t("hr.f.employee")} value={employeeId} onChange={setEmployeeId} options={employees} disabled={!!id} />
        <Input type="number" min={0} aria-label={t("hr.f.basicSalary")} placeholder={t("hr.f.basicSalary")} value={basic} onChange={(e) => setBasic(e.target.value)} />
        <PlainSelect label={t("hr.f.status")} value={status} onChange={setStatus} options={(["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) }))} />
        <Textarea rows={1} aria-label={t("hr.f.notes")} placeholder={t("hr.f.notes")} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{t("hr.salary.components")}</p>
        {lines.map((l, i) => (
          <div key={l.key} className="flex flex-wrap items-center gap-2">
            <PlainSelect label={t("hr.salary.componentN", { n: i + 1 })} className="w-80" value={l.componentId} onChange={(v) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, componentId: v } : x)))} options={components.map((o) => ({ value: String(o.id), label: compLabel(o) }))} />
            <Input type="number" min={0} className="w-36" aria-label={t("hr.salary.overrideN", { n: i + 1 })} placeholder={t("hr.salary.override")} value={l.value} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, value: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label={t("hr.salary.removeN", { n: i + 1 })} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {dup && <p className="text-destructive text-sm">{t("hr.salary.duplicate")}</p>}
        <Button variant="outline" className="w-fit" onClick={() => setLines((ls) => [...ls, { key: ++lineKey, componentId: "", value: "" }])}>
          <Plus className="size-4" /> {t("hr.salary.addComponent")}
        </Button>
      </div>
      {manage && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!valid}
            onClick={async () => {
              const body = { employeeId: Number(employeeId), basicSalary: Number(basic), status, notes: notes.trim() || undefined, components: lines.map((l) => ({ componentId: Number(l.componentId), value: l.value === "" ? undefined : Number(l.value) })) }
              let saved: Row | undefined
              if (await attempt(async () => (saved = await HR.salaries.save(id, body)), t("common.saved"))) {
                setId(saved?.id ?? id)
                onSaved()
              }
            }}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      )}
      {employeeId && id && <OvertimesAndLoans employeeId={employeeId} manage={manage} />}
    </>
  )
}

/** Manual overtimes (Pending → Approved / Rejected) and loans of one employee; both feed the next payroll run. */
function OvertimesAndLoans({ employeeId, manage }: { employeeId: string; manage: boolean }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const loanTypes = toSelect(useOptions("loanTypes", HrOptions.loanTypes))
  const [data, setData] = React.useState<{ overtimes: Row[]; loans: Row[] }>()
  const [reload, setReload] = React.useState(0)
  const [adding, setAdding] = React.useState<"overtime" | "loan">()
  React.useEffect(() => {
    let cancelled = false
    Promise.all([PayrollService.overtimes(employeeId), PayrollService.loans(employeeId)])
      .then(([overtimes, loans]) => !cancelled && setData({ overtimes: overtimes ?? [], loans: loans ?? [] }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [employeeId, reload])
  const overtimeFields: FieldDef[] = [
    { name: "title", label: "hr.f.title", required: true, max: 200, full: true },
    { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
    { name: "endDate", label: "hr.f.endDate", type: "date", required: true, check: (v) => (v.startDate && v.endDate && String(v.endDate) < String(v.startDate) ? "hr.v.endAfterStart" : undefined) },
    { name: "days", label: "hr.f.days", type: "number", required: true, min: 0 },
    { name: "hours", label: "hr.f.hours", type: "number", required: true, min: 0 },
    { name: "rate", label: "hr.f.rate", type: "number", required: true, min: 0 },
    { name: "notes", label: "hr.f.notes", type: "textarea", max: 1000 },
  ]
  const loanFields: FieldDef[] = [
    { name: "title", label: "hr.f.title", required: true, max: 200 },
    { name: "loanTypeId", label: "hr.f.loanType", type: "select", required: true, numeric: true, options: loanTypes },
    { name: "amount", label: "acc.amount", type: "number", required: true, min: 0 },
    { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
    { name: "monthlyInstallment", label: "hr.f.monthlyInstallment", type: "number", min: 0, check: (v) => (!v.monthlyInstallment === !v.installments ? "hr.v.installment" : undefined) },
    { name: "installments", label: "hr.f.installments", type: "number", min: 1, max: 600 },
    { name: "reason", label: "hr.f.reason", type: "textarea", max: 1000 },
  ]
  if (!data) return <Skeleton className="h-24 w-full" />
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{t("hr.pay.overtimes")}</CardTitle>
            <CardDescription>{t("hr.pay.overtimesHint")}</CardDescription>
          </div>
          {manage && (
            <Button variant="outline" size="sm" onClick={() => setAdding("overtime")}>
              <Plus className="size-4" /> {t("hr.pay.addOvertime")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {data.overtimes.length === 0 && (
                <TableRow>
                  <TableCell className="text-muted-foreground text-center">{t("hr.empty")}</TableCell>
                </TableRow>
              )}
              {data.overtimes.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{String(o.title ?? "")}</TableCell>
                  <TableCell>{`${formatDate(String(o.startDate ?? ""), language)} → ${formatDate(String(o.endDate ?? ""), language)}`}</TableCell>
                  <TableCell>{t("hr.pay.overtimeLine", { d: String(o.days ?? 0), h: String(o.hours ?? 0) })}</TableCell>
                  <TableCell className="text-right">{money(o.amount as number)}</TableCell>
                  <TableCell>{o.paidRunId ? <Badge variant="secondary">{t("hr.status.PAID")}</Badge> : <HrStatus status={o.status} />}</TableCell>
                  <TableCell className="text-right">
                    {manage && !o.paidRunId && o.status === "PENDING" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={async () => (await attempt(() => PayrollService.overtimeStatus(o.id ?? "", "APPROVED"), t("common.saved"))) && setReload((x) => x + 1)}>
                          {t("hr.approve")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={async () => (await attempt(() => PayrollService.overtimeStatus(o.id ?? "", "REJECTED"), t("common.saved"))) && setReload((x) => x + 1)}>
                          {t("hr.reject")}
                        </Button>
                      </>
                    )}
                    {manage && !o.paidRunId && (
                      <Button variant="ghost" size="icon" aria-label={t("hr.deleteOf", { name: String(o.title ?? "") })} onClick={async () => (await attempt(() => PayrollService.removeOvertime(o.id ?? ""), t("common.saved"))) && setReload((x) => x + 1)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{t("hr.pay.loans")}</CardTitle>
          {manage && (
            <Button variant="outline" size="sm" onClick={() => setAdding("loan")}>
              <Plus className="size-4" /> {t("hr.pay.addLoan")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {data.loans.length === 0 && (
                <TableRow>
                  <TableCell className="text-muted-foreground text-center">{t("hr.empty")}</TableCell>
                </TableRow>
              )}
              {data.loans.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {String(l.title ?? "")}
                    <span className="text-muted-foreground block text-xs">{String(l.loanTypeName ?? "")}</span>
                  </TableCell>
                  <TableCell className="text-right">{money(l.amount as number)}</TableCell>
                  <TableCell>{t("hr.pay.loanLine", { m: money(l.monthlyInstallment as number), n: String(l.installments ?? "-") })}</TableCell>
                  <TableCell className="text-right">{t("hr.pay.remaining", { a: money(l.remainingBalance as number) })}</TableCell>
                  <TableCell>
                    <HrStatus status={l.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {manage && (
                      <Button variant="ghost" size="icon" aria-label={t("hr.deleteOf", { name: String(l.title ?? "") })} onClick={async () => (await attempt(() => PayrollService.removeLoan(l.id ?? ""), t("common.saved"))) && setReload((x) => x + 1)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(undefined)}>
        <DialogContent className="sm:max-w-lg">
          {adding && (
            <FormDialogBody
              key={adding}
              prefix={adding}
              title={t(adding === "overtime" ? "hr.pay.addOvertime" : "hr.pay.addLoan")}
              fields={adding === "overtime" ? overtimeFields : loanFields}
              initial={initialValues(adding === "overtime" ? overtimeFields : loanFields, null, { startDate: today() })}
              onClose={() => setAdding(undefined)}
              onSubmit={async (body) => {
                const ok = await attempt(() => (adding === "overtime" ? PayrollService.addOvertime(employeeId, body) : PayrollService.addLoan(employeeId, body)), t("common.saved"))
                if (ok) setReload((x) => x + 1)
                return ok
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
