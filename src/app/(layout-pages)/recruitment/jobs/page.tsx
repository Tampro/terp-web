"use client"

import * as React from "react"
import { Lock, Send, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMoney } from "@/hooks/use-money"
import { HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { REC, RecOptions } from "@/lib/recruitment/recruitment.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, errorMessage, fieldErrors, FormFields, pick, TabbedPage, toBody, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef, type Values } from "../../hrm/_components/crud-kit"

const skillsOf = (v: unknown) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

export default function JobsPage() {
  return (
    <React.Suspense>
      <Jobs />
    </React.Suspense>
  )
}

/** §17 job postings: 3-step form (basics; experience & salary; details, questions, asked fields), Draft → Published → Closed. */
function Jobs() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("RECRUITMENT_MANAGE")
  const [editing, setEditing] = React.useState<{ row?: Row } | null>(null)
  const [reload, setReload] = React.useState(0)
  const is = (...s: string[]) => (r: Row) => s.includes(String(r.status))

  async function open(r?: Row) {
    if (!r) return setEditing({})
    try {
      setEditing({ row: await REC.postings.get(r.id ?? "") })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const cfg: CrudConfig = {
    id: "postings",
    load: REC.postings.list,
    keyword: true,
    statuses: ["DRAFT", "PUBLISHED", "CLOSED"],
    reloadKey: reload,
    onRowClick: (r) => void open(r),
    columns: [
      {
        label: "hr.f.title",
        render: (r) => (
          <span>
            {String(r.title ?? "")} {r.featured ? <Badge variant="secondary">{t("rc.featured")}</Badge> : null}
          </span>
        ),
      },
      { label: "rc.code", path: "jobCode", kind: "mono" },
      { label: "le.type", path: "jobType.name" },
      { label: "rc.location", path: "location.name" },
      { label: "rc.positions", path: "positions" },
      { label: "rc.salary", render: (r) => (r.minSalary != null || r.maxSalary != null ? `${money(r.minSalary as number)} – ${money(r.maxSalary as number)}` : "-") },
      { label: "rc.deadline", render: (r) => formatDate(String(r.applicationDeadline ?? ""), language) },
      { label: "rc.applications", path: "applications" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.title ?? ""),
    remove: REC.postings.remove,
    canDelete: is("DRAFT"),
    actions: [
      { key: "publish", label: "rc.publish", icon: <Send className="size-4" />, when: is("DRAFT"), run: (r) => REC.postings.put(r.id ?? "", "publish") },
      { key: "unpublish", label: "rc.unpublish", icon: <Undo2 className="size-4" />, when: is("PUBLISHED"), run: (r) => REC.postings.put(r.id ?? "", "unpublish") },
      { key: "close", label: "rc.close", icon: <Lock className="size-4" />, when: is("PUBLISHED"), confirmDesc: "rc.closeDesc", destructive: true, run: (r) => REC.postings.put(r.id ?? "", "close") },
    ],
    manage,
    toolbar: manage ? <Button onClick={() => open()}>{t("rc.job.create")}</Button> : undefined,
  }
  return (
    <>
      <TabbedPage title={t("menu.rc.jobs")} description={t("rc.jobs.subtitle")} tabs={[{ key: "list", label: "menu.rc.jobs", content: () => <CrudSection config={cfg} /> }]} />
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editing && <JobWizard key={editing.row?.id ?? "new"} row={editing.row} readOnly={!manage || editing.row?.status === "CLOSED"} onClose={() => setEditing(null)} onSaved={() => setReload((x) => x + 1)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** PostingForm in 3 steps; skills are typed comma separated; PUT is a full replacement. */
function JobWizard({ row, readOnly, onClose, onSaved }: { row?: Row; readOnly: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const jobTypes = toSelect(useOptions("rc:job-types", () => RecOptions.catalog("job-types")))
  const locations = toSelect(useOptions("rc:locations", RecOptions.locations))
  const questions = toSelect(useOptions("rc:questions", RecOptions.questions))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const [values, setValues] = React.useState<Values>(() => ({
    title: String(row?.title ?? ""),
    jobTypeId: String(pick(row, "jobType.id") ?? ""),
    locationId: String(pick(row, "location.id") ?? ""),
    branchId: String(pick(row, "branch.id") ?? ""),
    departmentId: String(pick(row, "department.id") ?? ""),
    priority: String(row?.priority ?? "MEDIUM"),
    positions: String(row?.positions ?? "1"),
    startDate: String(row?.startDate ?? ""),
    applicationDeadline: String(row?.applicationDeadline ?? ""),
    applicationType: String(row?.applicationType ?? "EXISTING"),
    applicationUrl: String(row?.applicationUrl ?? ""),
    skills: ((row?.skills as string[] | undefined) ?? []).join(", "),
    featured: !!row?.featured,
    minExperience: row?.minExperience != null ? String(row.minExperience) : "",
    maxExperience: row?.maxExperience != null ? String(row.maxExperience) : "",
    minSalary: row?.minSalary != null ? String(row.minSalary) : "",
    maxSalary: row?.maxSalary != null ? String(row.maxSalary) : "",
    description: String(row?.description ?? ""),
    requirements: String(row?.requirements ?? ""),
    benefits: String(row?.benefits ?? ""),
    customQuestionIds: ((row?.customQuestions as { id?: string }[] | undefined) ?? []).map((q) => String(q.id)),
    askGender: !!row?.askGender,
    askDateOfBirth: !!row?.askDateOfBirth,
    showCoverLetter: row ? !!row.showCoverLetter : true,
    showTerms: row ? !!row.showTerms : true,
  }))
  const branchId = String(values.branchId ?? "")
  const departments = toSelect(useOptions(`departments:${branchId}`, () => HrOptions.departments(branchId), !!branchId))
  const [step, setStep] = React.useState(0)
  const [saving, setSaving] = React.useState(false)
  const opt = (prefix: string, list: readonly string[]) => list.map((x) => ({ value: x, label: t(`${prefix}.${x}` as TranslationKey) }))
  const steps: { title: TranslationKey; fields: FieldDef[] }[] = [
    {
      title: "rc.step.basics",
      fields: [
        { name: "title", label: "hr.f.title", required: true, max: 200, full: true },
        { name: "jobTypeId", label: "le.type", type: "select", required: true, numeric: true, options: jobTypes },
        { name: "locationId", label: "rc.location", type: "select", required: true, numeric: true, options: locations },
        { name: "branchId", label: "hr.f.branch", type: "select", numeric: true, none: true, options: branches },
        { name: "departmentId", label: "hr.f.department", type: "select", numeric: true, none: true, options: departments, hidden: (v) => !v.branchId },
        { name: "priority", label: "rc.priorityLabel", type: "select", options: opt("rc.priority", ["LOW", "MEDIUM", "HIGH"]) },
        { name: "positions", label: "rc.positions", type: "number", min: 1, max: 10000 },
        { name: "startDate", label: "hr.f.startDate", type: "date" },
        { name: "applicationDeadline", label: "rc.deadline", type: "date" },
        { name: "applicationType", label: "rc.applyAt", type: "select", options: opt("rc.applyType", ["EXISTING", "CUSTOM"]) },
        { name: "applicationUrl", label: "rc.applicationUrl", max: 500, pattern: /^https?:\/\/\S+$/, patternMsg: "tr.v.url", hidden: (v) => v.applicationType !== "CUSTOM", check: (v) => (v.applicationType === "CUSTOM" && !v.applicationUrl ? "rc.v.url" : undefined) },
        { name: "skills", label: "rc.skills", full: true },
        { name: "featured", label: "rc.featured", type: "switch" },
      ],
    },
    {
      title: "rc.step.experience",
      fields: [
        { name: "minExperience", label: "rc.minExperience", type: "number", min: 0, max: 60 },
        { name: "maxExperience", label: "rc.maxExperience", type: "number", min: 0, max: 60, check: (v) => (v.minExperience && v.maxExperience && Number(v.maxExperience) < Number(v.minExperience) ? "rc.v.minMax" : undefined) },
        { name: "minSalary", label: "rc.minSalary", type: "number", min: 0 },
        { name: "maxSalary", label: "rc.maxSalary", type: "number", min: 0, check: (v) => (v.minSalary && v.maxSalary && Number(v.maxSalary) < Number(v.minSalary) ? "rc.v.minMax" : undefined) },
      ],
    },
    {
      title: "rc.step.details",
      fields: [
        { name: "description", label: "hr.f.description", type: "textarea", max: 100000 },
        { name: "requirements", label: "rc.requirements", type: "textarea", max: 100000 },
        { name: "benefits", label: "rc.benefits", type: "textarea", max: 100000 },
        { name: "customQuestionIds", label: "rc.customQuestions", type: "multi", options: questions },
        { name: "askGender", label: "rc.askGender", type: "switch" },
        { name: "askDateOfBirth", label: "rc.askDateOfBirth", type: "switch" },
        { name: "showCoverLetter", label: "rc.showCoverLetter", type: "switch" },
        { name: "showTerms", label: "rc.showTerms", type: "switch" },
      ],
    },
  ]
  const current = steps[step]
  const errors = fieldErrors(current.fields, values, t)
  const valid = !Object.values(errors).some(Boolean)
  const last = step === steps.length - 1
  function onChange(v: Values) {
    if (v.branchId !== values.branchId) v = { ...v, departmentId: "" }
    setValues(v)
  }
  async function save() {
    const all = steps.flatMap((s) => s.fields)
    const b = toBody(all, values)
    const body = { ...b, skills: skillsOf(values.skills) }
    setSaving(true)
    const ok = await attempt(() => REC.postings.save(row?.id, body), t("common.saved"))
    setSaving(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{row ? String(row.title ?? "") : t("rc.job.create")}</DialogTitle>
        <DialogDescription>
          {t("hr.emp.stepOf", { n: step + 1, total: steps.length })}: {t(current.title)}
        </DialogDescription>
      </DialogHeader>
      <fieldset disabled={readOnly} className="contents">
        <FormFields key={step} fields={current.fields} values={values} onChange={onChange} errors={errors} prefix="job" />
      </fieldset>
      <DialogFooter>
        <Button variant="outline" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}>
          {step === 0 ? t("common.cancel") : t("hr.back")}
        </Button>
        {last ? (
          !readOnly && (
            <Button key="save" disabled={!valid || saving} onClick={save}>
              {t("common.save")}
            </Button>
          )
        ) : (
          <Button key="next" disabled={!valid} onClick={() => setStep((s) => s + 1)}>
            {t("hr.next")}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

