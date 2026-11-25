"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUrlQuery } from "@/hooks/use-url-query"

import { useMoney } from "@/hooks/use-money"
import { HrOptions, PerfOptions, TRAINING, type Row } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, errorMessage, Field, pick, PlainSelect, TabbedPage, today, toSelect, useAuthStore, useOptions, type CrudConfig, orgChain } from "../_components/crud-kit"

export default function TrainingPage() {
  return (
    <React.Suspense>
      <Training />
    </React.Suspense>
  )
}

const when = (v: unknown, language: string) => {
  const s = String(v ?? "")
  return s ? `${formatDate(s.slice(0, 10), language)} ${s.slice(11, 16)}` : "-"
}

/** §16 training: sessions (schedule, trainer, location; Scheduled / In Progress / Completed / Cancelled), programs (type, cost, capacity), trainees, trainers, training types. */
function Training() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("TRAINING_MANAGE")
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const departmentOpts = useOptions("departments", () => HrOptions.departments())
  const departments = toSelect(departmentOpts)
  const chain = orgChain(departmentOpts, [])
  const types = toSelect(useOptions("training:types", PerfOptions.trainingTypes))
  const trainers = toSelect(useOptions("training:trainers", PerfOptions.trainers))
  const programs = toSelect(useOptions("training:programs", PerfOptions.programs))
  const opts = (prefix: string, list: readonly string[]) => list.map((x) => ({ value: x, label: t(`${prefix}.${x}` as TranslationKey) }))
  const SESSION = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const
  const PROGRAM = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const
  const TRAINEE = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED"] as const
  const ASSESSMENT = ["QUIZ", "PRACTICAL", "PRESENTATION"] as const
  const { searchParams, update } = useUrlQuery()
  const f = (k: string) => searchParams.get(k) ?? ""
  /** a list filter kept in the URL (`?<param>=`), sent to the backend as `query` */
  const filter = (param: string, label: TranslationKey, none: TranslationKey, options: { value: string; label: string }[], resets: string[] = []) => (
    <PlainSelect key={param} label={t(label)} className="w-48" value={f(param)} none={t(none)} options={options} onChange={(v) => update({ [param]: v || undefined, ...Object.fromEntries(resets.map((r) => [r, undefined])), page: undefined })} />
  )
  const orgFilters = (
    <>
      {filter("branchId", "hr.f.branch", "tr.allBranches", branches, ["departmentId"])}
      {filter("departmentId", "hr.f.department", "tr.allDepartments", chain.departmentsOf("branchId")({ branchId: f("branchId") }))}
    </>
  )
  const orgQuery = { branchId: f("branchId") || undefined, departmentId: f("departmentId") || undefined }
  const programFilter = filter("programId", "tr.program", "tr.allPrograms", programs)
  const [viewing, setViewing] = React.useState<Row>()

  const sessions: CrudConfig = {
    id: "sessions",
    query: { programId: f("programId") || undefined },
    toolbar: programFilter,
    load: TRAINING.sessions.list,
    countsPath: "/v1/training/sessions/status-counts",
    keyword: true,
    statuses: [...SESSION],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "tr.program", path: "program.name" },
      { label: "tr.trainer", render: (r) => String(pick(r, "trainer.name") ?? ((r.trainers as { fullName?: string }[] | undefined) ?? []).map((x) => x.fullName).join(", ") ?? "-") || "-" },
      { label: "tr.schedule", render: (r) => `${when(r.startAt, language)} → ${String(r.endAt ?? "").slice(11, 16)}` },
      { label: "tr.location", render: (r) => [t(`tr.loc.${String(r.locationType)}` as TranslationKey), r.location].filter(Boolean).join(" · ") },
      { label: "tr.capacity", render: (r) => `${String(r.attendees ?? 0)}/${String(pick(r, "program.capacity") ?? "-")}` },
      { label: "tr.cost", render: (r) => money(pick(r, "program.cost") as number) },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "tr.session.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 200, full: true },
      { name: "programId", label: "tr.program", type: "select", required: true, numeric: true, options: programs },
      { name: "trainerId", label: "tr.trainer", type: "select", numeric: true, none: true, options: trainers },
      { name: "startAt", label: "tr.startAt", type: "datetime", required: true },
      { name: "endAt", label: "tr.endAt", type: "datetime", required: true, check: (v) => (v.startAt && v.endAt && String(v.endAt) <= String(v.startAt) ? "tr.v.endAfterStart" : undefined) },
      { name: "locationType", label: "tr.locationType", type: "select", required: true, options: opts("tr.loc", ["IN_PERSON", "VIRTUAL", "HYBRID"]) },
      { name: "status", label: "hr.f.status", type: "select", options: opts("hr.status", SESSION) },
      { name: "location", label: "tr.location", max: 300, hidden: (v) => v.locationType === "VIRTUAL" },
      { name: "meetingLink", label: "tr.meetingLink", max: 500, pattern: /^https?:\/\/\S+$/, patternMsg: "tr.v.url", hidden: (v) => v.locationType === "IN_PERSON" },
      { name: "notes", label: "hr.f.notes", type: "textarea", max: 5000 },
    ],
    defaults: { locationType: "IN_PERSON", status: "SCHEDULED" },
    toValues: (r) => ({ ...r, programId: pick(r, "program.id"), trainerId: pick(r, "trainer.id") }),
    save: TRAINING.sessions.save,
    remove: TRAINING.sessions.remove,
    manage,
  }
  const programsCfg: CrudConfig = {
    id: "programs",
    query: { typeId: f("typeId") || undefined },
    toolbar: filter("typeId", "tr.type", "tr.allTypes", types),
    load: TRAINING.programs.list,
    countsPath: "/v1/training/programs/status-counts",
    keyword: true,
    statuses: [...PROGRAM],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "tr.type", path: "trainingType.name" },
      { label: "tr.duration", render: (r) => (r.durationHours != null ? `${String(r.durationHours)} h` : "-") },
      { label: "tr.cost", path: "cost", kind: "money" },
      { label: "tr.capacity", render: (r) => `${String(r.employees ?? 0)}/${String(r.capacity ?? "-")}` },
      { label: "tr.sessions", render: (r) => `${String(r.completedSessions ?? 0)}/${String(r.sessions ?? 0)}` },
      { label: "tr.mandatory", path: "mandatory", kind: "bool" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "tr.program.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 200, full: true },
      { name: "trainingTypeId", label: "tr.type", type: "select", required: true, numeric: true, options: types },
      { name: "status", label: "hr.f.status", type: "select", options: opts("hr.status", PROGRAM) },
      { name: "durationHours", label: "tr.durationHours", type: "number", min: 0 },
      { name: "cost", label: "tr.cost", type: "number", min: 0 },
      { name: "capacity", label: "tr.capacity", type: "number", min: 1 },
      { name: "mandatory", label: "tr.mandatory", type: "switch" },
      { name: "selfEnrollment", label: "tr.selfEnrollment", type: "switch" },
      { name: "prerequisites", label: "tr.prerequisites", type: "textarea", max: 5000 },
      { name: "description", label: "hr.f.description", type: "textarea", max: 5000 },
    ],
    defaults: { status: "DRAFT" },
    toValues: (r) => ({ ...r, trainingTypeId: pick(r, "trainingType.id") }),
    save: TRAINING.programs.save,
    remove: TRAINING.programs.remove,
    invalidates: true,
    manage,
  }
  const trainees: CrudConfig = {
    id: "trainees",
    query: { programId: f("programId") || undefined },
    toolbar: programFilter,
    load: TRAINING.trainings.list,
    countsPath: "/v1/training/employee-trainings/status-counts",
    keyword: true,
    statuses: [...TRAINEE],
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "tr.program", path: "program.name" },
      { label: "tr.assignedDate", path: "assignedDate", kind: "date" },
      { label: "tr.completionDate", path: "completionDate", kind: "date" },
      { label: "tr.score", render: (r) => (r.score != null ? `${String(r.score)}${r.result ? ` · ${t(`tr.result.${String(r.result)}` as TranslationKey)}` : ""}` : "-") },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => `${String(pick(r, "employee.fullName") ?? "")} · ${String(pick(r, "program.name") ?? "")}`,
    createLabel: "tr.assign",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "programId", label: "tr.program", type: "select", required: true, numeric: true, options: programs },
      { name: "assignedDate", label: "tr.assignedDate", type: "date", required: true },
      { name: "status", label: "hr.f.status", type: "select", options: opts("hr.status", TRAINEE) },
      { name: "completionDate", label: "tr.completionDate", type: "date", hidden: (v) => v.status !== "COMPLETED" && v.status !== "FAILED" },
      { name: "score", label: "tr.score", type: "number", min: 0, max: 100, hidden: (v) => v.status !== "COMPLETED" && v.status !== "FAILED" },
      { name: "passed", label: "tr.passed", type: "switch", hidden: (v) => v.status !== "COMPLETED" && v.status !== "FAILED" },
      { name: "certificateMediaId", label: "tr.certificate", type: "file", hidden: (v) => v.status !== "COMPLETED" },
      { name: "feedback", label: "hr.f.feedback", type: "textarea", max: 5000 },
      { name: "notes", label: "hr.f.notes", type: "textarea", max: 5000 },
    ],
    defaults: { status: "ASSIGNED", assignedDate: new Date().toLocaleDateString("en-CA") },
    toValues: (r: Row) => ({ ...r, employeeId: pick(r, "employee.id"), programId: pick(r, "program.id"), certificateMediaId: r.certificateId, certificateMediaId__name: pick(r, "certificate.name") }),
    save: TRAINING.trainings.save,
    remove: TRAINING.trainings.remove,
    manage,
  }
  const trainersCfg: CrudConfig = {
    id: "trainers",
    query: orgQuery,
    toolbar: orgFilters,
    load: TRAINING.trainers.list,
    keyword: true,
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.email", path: "email" },
      { label: "hr.f.phone", path: "contactPhone" },
      { label: "tr.expertise", path: "expertise" },
      { label: "tr.experience", render: (r) => (r.experienceYears != null ? t("tr.years", { n: String(r.experienceYears) }) : "-") },
      { label: "hr.f.branch", path: "branch.name" },
      { label: "hr.f.active", path: "active", kind: "bool" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "tr.trainer.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "email", label: "hr.f.email", type: "email", max: 150, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
      { name: "contactPhone", label: "hr.f.phone", max: 30 },
      { name: "experienceYears", label: "tr.experienceYears", type: "number", min: 0, max: 80 },
      { name: "branchId", label: "hr.f.branch", type: "select", numeric: true, none: true, options: branches, resets: ["departmentId"] },
      { name: "departmentId", label: "hr.f.department", type: "select", numeric: true, none: true, optionsFor: chain.departmentsOf("branchId") },
      { name: "active", label: "hr.f.active", type: "switch" },
      { name: "expertise", label: "tr.expertise", type: "textarea", max: 500 },
      { name: "qualification", label: "tr.qualification", type: "textarea", max: 500 },
    ],
    defaults: { active: true },
    toValues: (r) => ({ ...r, branchId: pick(r, "branch.id"), departmentId: pick(r, "department.id") }),
    save: TRAINING.trainers.save,
    remove: TRAINING.trainers.remove,
    invalidates: true,
    manage,
  }
  const typesCfg: CrudConfig = {
    id: "types",
    query: orgQuery,
    toolbar: orgFilters,
    load: TRAINING.types.list,
    keyword: true,
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.branch", path: "branch.name" },
      { label: "hr.f.departments", render: (r) => ((r.departments as { name?: string }[] | undefined) ?? []).map((d) => d.name).join(", ") || "-" },
      { label: "tr.programs", path: "programs" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "tr.type.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "branchId", label: "hr.f.branch", type: "select", numeric: true, none: true, options: branches },
      { name: "departmentIds", label: "hr.f.departments", type: "multi", options: departments },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    toValues: (r) => ({ ...r, branchId: pick(r, "branch.id"), departmentIds: ((r.departments as { id?: string }[] | undefined) ?? []).map((d) => d.id) }),
    // TypeForm has no departments: they are set with PUT /types/{id}/departments (DepartmentsForm)
    save: async (id, body) => {
      const { departmentIds, ...rest } = body
      const saved = await TRAINING.types.save(id, rest)
      await TRAINING.types.put(saved.id ?? id ?? "", "departments", { departmentIds: departmentIds ?? [] })
      return saved
    },
    remove: TRAINING.types.remove,
    invalidates: true,
    manage,
  }
  const assessments: CrudConfig = {
    id: "assessments",
    load: TRAINING.assessments.list,
    countsPath: "/v1/training/assessments/type-counts",
    keyword: true,
    statuses: [...ASSESSMENT],
    statusParam: "type",
    query: { programId: f("programId") || undefined },
    toolbar: programFilter,
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "tr.program", path: "program.name" },
      { label: "tr.assessmentType", render: (r) => t(`hr.status.${String(r.type)}` as TranslationKey) },
      { label: "tr.passingScore", render: (r) => (r.passingScore != null ? `${String(r.passingScore)}%` : "-") },
      { label: "tr.results", path: "results" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "tr.assessment.create",
    emptyLabel: "tr.assessment.empty",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 200, full: true },
      { name: "programId", label: "tr.program", type: "select", required: true, numeric: true, options: programs },
      { name: "type", label: "tr.assessmentType", type: "select", required: true, options: opts("hr.status", ASSESSMENT) },
      { name: "passingScore", label: "tr.passingScoreField", type: "number", required: true },
      { name: "description", label: "hr.f.description", type: "textarea", max: 5000 },
      { name: "criteria", label: "tr.criteria", type: "textarea", max: 5000 },
    ],
    defaults: { type: "QUIZ", passingScore: 70 },
    toValues: (r) => ({ ...r, programId: pick(r, "program.id") }),
    save: TRAINING.assessments.save,
    remove: TRAINING.assessments.remove,
    // the backend refuses to delete an assessment that still has results
    canDelete: (r) => !Number(r.results ?? 0),
    onRowClick: (r) => setViewing(r),
    manage,
  }
  return (
    <>
    <TabbedPage
      title={t("menu.tr.training")}
      description={t("tr.subtitle")}
      tabs={[
        { key: "sessions", label: "tr.sessionsTab", content: () => <CrudSection config={sessions} /> },
        { key: "programs", label: "tr.programsTab", content: () => <CrudSection config={programsCfg} /> },
        { key: "trainees", label: "tr.trainees", content: () => <CrudSection config={trainees} /> },
        { key: "trainers", label: "tr.trainers", content: () => <CrudSection config={trainersCfg} /> },
        { key: "types", label: "tr.types", content: () => <CrudSection config={typesCfg} /> },
        { key: "assessments", label: "tr.assessments", content: () => <CrudSection config={assessments} /> },
      ]}
    />
    <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{viewing?.id && <AssessmentView key={viewing.id} id={viewing.id} manage={manage} />}</DialogContent>
    </Dialog>
    </>
  )
}

interface ResultRow {
  id?: string
  employeeTrainingId?: string
  employee?: { fullName?: string }
  score?: number
  passed?: boolean
  assessedDate?: string
  notes?: string
}

/** Assessment detail: statistics (results, pass rate, average, passed / failed) and results; add a result for a trainee of the program (ResultForm). */
function AssessmentView({ id, manage }: { id: string; manage: boolean }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [reload, setReload] = React.useState(0)
  const [data, setData] = React.useState<{ a: Row; trainees: { value: string; label: string }[] }>()
  const [form, setForm] = React.useState({ employeeTrainingId: "", score: "", assessedDate: today(), notes: "" })
  React.useEffect(() => {
    let cancelled = false
    TRAINING.assessments
      .get(id)
      .then(async (a) => {
        const programId = String(pick(a, "program.id") ?? "")
        const page = programId ? await TRAINING.trainings.list({ programId, size: 200 }) : []
        const rows = Array.isArray(page) ? page : (page.content ?? [])
        if (!cancelled) setData({ a, trainees: rows.map((r) => ({ value: String(r.id), label: String(pick(r, "employee.fullName") ?? r.id) })) })
      })
      .catch((e) => !cancelled && toast.error(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [id, reload])
  if (!data) return <Skeleton className="h-48 w-full" />
  const { a } = data
  const st = (a.statistics ?? {}) as { totalResults?: number; passRate?: number; averageScore?: number; passed?: number; failed?: number }
  const results = (a.resultList ?? []) as ResultRow[]
  // one result per trainee (EMP_091): those already assessed are not offered again
  const assessed = new Set(results.map((r) => String(r.employeeTrainingId)))
  const open = data.trainees.filter((x) => !assessed.has(x.value))
  const score = Number(form.score)
  const scoreError = form.score !== "" && !(score >= 0 && score <= 100) ? t("tr.v.score") : undefined
  const valid = !!form.employeeTrainingId && form.score !== "" && !scoreError
  async function add() {
    const ok = await attempt(() => TRAINING.assessments.post(id, "results", { employeeTrainingId: Number(form.employeeTrainingId), score, assessedDate: form.assessedDate || undefined, notes: form.notes.trim() || undefined }), t("common.saved"))
    if (ok) {
      setForm({ employeeTrainingId: "", score: "", assessedDate: today(), notes: "" })
      setReload((x) => x + 1)
    }
  }
  async function removeResult(r: ResultRow) {
    if (await attempt(() => TRAINING.removeResult(id, String(r.id)), t("common.saved"))) setReload((x) => x + 1)
  }
  const stats: [TranslationKey, string | number][] = [
    ["tr.results", st.totalResults ?? 0],
    ["tr.passRate", `${st.passRate ?? 0}%`],
    ["tr.averageScore", st.averageScore != null ? Number(st.averageScore).toFixed(1) : "-"],
    ["tr.passed", st.passed ?? 0],
    ["tr.failed", st.failed ?? 0],
  ]
  return (
    <>
      <DialogHeader>
        <DialogTitle>{String(a.name ?? "")}</DialogTitle>
      </DialogHeader>
      <div className="text-muted-foreground text-sm">
        {String(pick(a, "program.name") ?? "-")} · {t(`hr.status.${String(a.type)}` as TranslationKey)} · {t("tr.passingScoreIs", { n: String(a.passingScore ?? "-") })}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="assessment-stats">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-md border p-2">
            <div className="text-muted-foreground text-xs">{t(k)}</div>
            <div className="text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("hr.f.employee")}</TableHead>
              <TableHead className="text-right">{t("tr.score")}</TableHead>
              <TableHead>{t("tr.result")}</TableHead>
              <TableHead>{t("hr.f.date")}</TableHead>
              <TableHead>{t("tr.notes")}</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  {t("tr.noResults")}
                </TableCell>
              </TableRow>
            )}
            {results.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.employee?.fullName ?? "-"}</TableCell>
                <TableCell className="text-right">{r.score != null ? `${r.score}%` : "-"}</TableCell>
                <TableCell>{r.passed ? t("tr.passed") : t("tr.failed")}</TableCell>
                <TableCell>{formatDate(r.assessedDate, language)}</TableCell>
                <TableCell className="max-w-60 truncate">{r.notes ?? "-"}</TableCell>
                <TableCell>
                  {manage && r.id && (
                    <Button variant="ghost" size="icon" aria-label={t("tr.removeResult", { name: r.employee?.fullName ?? "" })} onClick={() => void removeResult(r)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {manage && (
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
          <Field id="ar-trainee" label={t("tr.trainee")} className="sm:col-span-2">
            <PlainSelect id="ar-trainee" label={t("tr.trainee")} value={form.employeeTrainingId} onChange={(v) => setForm({ ...form, employeeTrainingId: v })} none={!data.trainees.length ? t("tr.noTrainees") : open.length ? t("tr.pickTrainee") : t("tr.allAssessed")} options={open} />
          </Field>
          <Field id="ar-score" label={t("tr.scorePct")} error={scoreError}>
            <Input id="ar-score" type="number" min={0} max={100} step="any" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
          </Field>
          <Field id="ar-date" label={t("hr.f.date")}>
            <Input id="ar-date" type="date" value={form.assessedDate} onChange={(e) => setForm({ ...form, assessedDate: e.target.value })} />
          </Field>
          <Field id="ar-notes" label={t("tr.notes")} className="sm:col-span-3">
            <Input id="ar-notes" maxLength={5000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button className="w-full" disabled={!valid} onClick={add}>
              {t("tr.addResult")}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
