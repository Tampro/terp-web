"use client"

import * as React from "react"
import { Check, Play } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { REC, RecOptions, RecruitmentService, type OnboardingDetail } from "@/lib/recruitment/recruitment.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { CrudSection, HrStatus, pick, TabbedPage, toSelect, today, useAuthStore, useOptions, type CrudConfig } from "../../hrm/_components/crud-kit"

export default function OnboardingPage() {
  return (
    <React.Suspense>
      <Onboarding />
    </React.Suspense>
  )
}

/** §17 onboarding: hired employee, checklist, start date, buddy; Pending → In Progress → Completed; tasks with due dates (start + due day). */
function Onboarding() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("RECRUITMENT_MANAGE")
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const checklists = toSelect(useOptions("rec:checklists", RecOptions.checklists))
  const candidates = toSelect(useOptions("rec:candidates", RecOptions.candidates))
  const [viewing, setViewing] = React.useState<string>()
  const is = (...s: string[]) => (r: Row) => s.includes(String(r.status))
  const cfg: CrudConfig = {
    id: "onboardings",
    load: REC.onboardings.list,
    countsPath: "/v1/recruitment/onboardings/status-counts",
    keyword: true,
    statuses: ["PENDING", "IN_PROGRESS", "COMPLETED"],
    onRowClick: (r) => setViewing(r.id),
    columns: [
      { label: "hr.f.employee", path: "employee.name" },
      { label: "rc.checklist", path: "checklist.name" },
      { label: "hr.f.startDate", path: "startDate", kind: "date" },
      { label: "rc.buddy", path: "buddy.name" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(pick(r, "employee.name") ?? ""),
    createLabel: "rc.onboarding.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "checklistId", label: "rc.checklist", type: "select", required: true, numeric: true, options: checklists },
      { name: "startDate", label: "hr.f.startDate", type: "date", required: true },
      { name: "buddyEmployeeId", label: "rc.buddy", type: "select", numeric: true, none: true, options: employees, check: (v) => (v.buddyEmployeeId && v.buddyEmployeeId === v.employeeId ? "rc.v.buddy" : undefined) },
      { name: "candidateId", label: "rc.hiredCandidate", type: "select", numeric: true, none: true, options: candidates, full: true },
    ],
    defaults: { startDate: today() },
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), checklistId: pick(r, "checklist.id"), buddyEmployeeId: pick(r, "buddy.id") }),
    save: REC.onboardings.save,
    remove: REC.onboardings.remove,
    canEdit: is("PENDING", "IN_PROGRESS"),
    actions: [
      { key: "start", label: "pf.review.start", icon: <Play className="size-4" />, when: is("PENDING"), run: (r) => REC.onboardings.put(r.id ?? "", "status", { status: "IN_PROGRESS" }) },
      { key: "complete", label: "rc.complete", icon: <Check className="size-4" />, when: is("PENDING", "IN_PROGRESS"), run: (r) => REC.onboardings.put(r.id ?? "", "status", { status: "COMPLETED" }) },
    ],
    manage,
  }
  return (
    <>
      <TabbedPage title={t("menu.rc.onboarding")} description={t("rc.onboarding.subtitle")} tabs={[{ key: "list", label: "menu.rc.onboarding", content: () => <CrudSection config={cfg} /> }]} />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{viewing && <OnboardingView key={viewing} id={viewing} />}</DialogContent>
      </Dialog>
    </>
  )
}

function OnboardingView({ id }: { id: string }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [d, setD] = React.useState<OnboardingDetail>()
  React.useEffect(() => {
    let cancelled = false
    RecruitmentService.onboarding(id)
      .then((x) => !cancelled && setD(x))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id])
  if (!d) return <Skeleton className="h-48 w-full" />
  return (
    <>
      <DialogHeader>
        <DialogTitle>{d.employee?.name}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          {d.checklist?.name} · {formatDate(d.startDate, language)} {d.buddy?.name && `· ${t("rc.buddy")}: ${d.buddy.name}`} <HrStatus status={d.status} />
        </DialogDescription>
      </DialogHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("rc.task")}</TableHead>
            <TableHead>{t("hr.f.category")}</TableHead>
            <TableHead>{t("hr.f.dueDate")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!d.checklist?.items?.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground text-center">
                {t("hr.empty")}
              </TableCell>
            </TableRow>
          )}
          {(d.checklist?.items ?? []).map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                {i.taskName} {i.required && <Badge variant="outline">{t("hr.f.required")}</Badge>}
                {i.description && <span className="text-muted-foreground block text-xs">{i.description}</span>}
              </TableCell>
              <TableCell>{t(`rc.cat.${i.category ?? "OTHER"}` as TranslationKey)}</TableCell>
              <TableCell>{formatDate(i.dueDate, language)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
