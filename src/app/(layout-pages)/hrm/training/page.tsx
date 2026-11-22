"use client"

import * as React from "react"

import { useMoney } from "@/hooks/use-money"
import { HrOptions, PerfOptions, TRAINING, type Row } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { CrudSection, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig } from "../_components/crud-kit"

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
  const departments = toSelect(useOptions("departments", () => HrOptions.departments()))
  const types = toSelect(useOptions("training:types", PerfOptions.trainingTypes))
  const trainers = toSelect(useOptions("training:trainers", PerfOptions.trainers))
  const programs = toSelect(useOptions("training:programs", PerfOptions.programs))
  const opts = (prefix: string, list: readonly string[]) => list.map((x) => ({ value: x, label: t(`${prefix}.${x}` as TranslationKey) }))
  const SESSION = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const
  const PROGRAM = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const
  const TRAINEE = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED"] as const

  const sessions: CrudConfig = {
    id: "sessions",
    load: TRAINING.sessions.list,
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
    load: TRAINING.programs.list,
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
    load: TRAINING.trainings.list,
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
      { name: "branchId", label: "hr.f.branch", type: "select", numeric: true, none: true, options: branches },
      { name: "departmentId", label: "hr.f.department", type: "select", numeric: true, none: true, options: departments },
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
  return (
    <TabbedPage
      title={t("menu.tr.training")}
      description={t("tr.subtitle")}
      tabs={[
        { key: "sessions", label: "tr.sessionsTab", content: () => <CrudSection config={sessions} /> },
        { key: "programs", label: "tr.programsTab", content: () => <CrudSection config={programsCfg} /> },
        { key: "trainees", label: "tr.trainees", content: () => <CrudSection config={trainees} /> },
        { key: "trainers", label: "tr.trainers", content: () => <CrudSection config={trainersCfg} /> },
        { key: "types", label: "tr.types", content: () => <CrudSection config={typesCfg} /> },
      ]}
    />
  )
}
