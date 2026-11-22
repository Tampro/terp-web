"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, EmployeeService, HrOptions, type EmployeeListItem } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { HrStatus, PlainSelect, toSelect, useAuthStore, useOptions } from "../_components/crud-kit"
import { EmployeeWizard } from "./_components/employee-wizard"

const PAGE_SIZE = 20
const ALL = "ALL"

export default function EmployeesPage() {
  return (
    <React.Suspense>
      <Employees />
    </React.Suspense>
  )
}

/** §15 employees: tabs per employment type, filters (keyword, status, branch, department), 6-step create wizard. */
function Employees() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const create = !!useAuthStore((s) => s.me?.permissions)?.includes("EMPLOYEE_CREATE")
  const { searchParams, update } = useUrlQuery()
  const type = searchParams.get("type") ?? ALL
  const status = searchParams.get("status") ?? ""
  const branchId = searchParams.get("branchId") ?? ""
  const departmentId = searchParams.get("departmentId") ?? ""
  const keyword = searchParams.get("q") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [draft, setDraft] = React.useState(keyword)
  const [data, setData] = React.useState<IPage<EmployeeListItem>>()
  const [counts, setCounts] = React.useState<{ all?: number; byType?: Record<string, number> }>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [creating, setCreating] = React.useState(false)
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const departments = toSelect(useOptions(`departments:${branchId}`, () => HrOptions.departments(branchId || undefined)))

  React.useEffect(() => {
    let cancelled = false
    const filters = { keyword: keyword || undefined, status: status || undefined, branchId: branchId || undefined, departmentId: departmentId || undefined }
    Promise.all([EmployeeService.list({ ...filters, employmentType: type === ALL ? undefined : type, page, size: PAGE_SIZE }), EmployeeService.typeCounts(filters).catch(() => undefined)])
      .then(([p, c]) => {
        if (cancelled) return
        setData(p)
        setCounts(c)
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [type, status, branchId, departmentId, keyword, page, reloadKey])

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.hr.employees")} description={t("hr.emp.subtitle")}>
        {create && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t("hr.emp.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={type} onValueChange={(v) => update({ type: v === ALL ? "" : v, page: 0 })}>
            <div className="max-w-full overflow-x-auto">
              <TabsList>
                <TabsTrigger value={ALL}>
                  {t("companies.tabAll")} ({counts?.all ?? 0})
                </TabsTrigger>
                {EMPLOYMENT_TYPES.map((x) => (
                  <TabsTrigger key={x} value={x}>
                    {t(`hr.type.${x}`)} ({counts?.byType?.[x] ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
          <div className="flex flex-wrap items-end gap-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                update({ q: draft.trim(), page: 0 })
              }}
            >
              <Input className="w-56" aria-label={t("hr.emp.search")} placeholder={t("hr.emp.search")} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" variant="outline" size="icon" aria-label={t("hr.search")}>
                <Search className="size-4" />
              </Button>
            </form>
            <PlainSelect label={t("hr.f.status")} className="w-40" value={status} onChange={(v) => update({ status: v, page: 0 })} none={t("hr.allStatuses")} options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: t(`hr.status.${s}`) }))} />
            <PlainSelect label={t("hr.f.branch")} className="w-44" value={branchId} onChange={(v) => update({ branchId: v, departmentId: "", page: 0 })} none={t("hr.allBranches")} options={branches} />
            <PlainSelect label={t("hr.f.department")} className="w-44" value={departmentId} onChange={(v) => update({ departmentId: v, page: 0 })} none={t("hr.allDepartments")} options={departments} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hr.f.employeeNo")}</TableHead>
                  <TableHead>{t("hr.f.fullName")}</TableHead>
                  <TableHead>{t("hr.f.branch")}</TableHead>
                  <TableHead>{t("hr.f.department")}</TableHead>
                  <TableHead>{t("hr.f.designation")}</TableHead>
                  <TableHead>{t("hr.f.employmentType")}</TableHead>
                  <TableHead>{t("hr.f.dateOfJoining")}</TableHead>
                  <TableHead>{t("hr.f.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                      {t("hr.emp.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.employeeNo}</TableCell>
                      <TableCell>
                        <Link href={`/hrm/employees/${e.id}`} className="font-medium underline-offset-4 hover:underline">
                          {e.fullName}
                        </Link>
                        <span className="text-muted-foreground block text-xs">{e.email}</span>
                      </TableCell>
                      <TableCell>{e.branch?.name ?? "-"}</TableCell>
                      <TableCell>{e.department?.name ?? "-"}</TableCell>
                      <TableCell>{e.designation?.name ?? "-"}</TableCell>
                      <TableCell>{e.employmentType ? t(`hr.type.${e.employmentType}` as TranslationKey) : "-"}</TableCell>
                      <TableCell>{formatDate(e.dateOfJoining, language)}</TableCell>
                      <TableCell>
                        <HrStatus status={e.status} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{creating && <EmployeeWizard onClose={() => setCreating(false)} onSaved={() => setReloadKey((x) => x + 1)} />}</DialogContent>
      </Dialog>
    </div>
  )
}
