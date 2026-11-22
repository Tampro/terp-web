"use client"

import * as React from "react"
import { Check, ClipboardCheck, Eye, Play, Reply, Target, UserCheck, X } from "lucide-react"

import { HR, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { useT } from "@/lib/i18n"

import { CrudSection, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../_components/crud-kit"

export default function IssuesPage() {
  return (
    <React.Suspense>
      <Issues />
    </React.Suspense>
  )
}

/** §15 issues: complaints (Pending → In Review → Assigned → In Progress → Resolved, follow-up) and warnings (Pending → Approved / Rejected, improvement plan, employee response). */
function Issues() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("LIFECYCLE_MANAGE")
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const complaintTypes = toSelect(useOptions("catalog:complaint-types", () => HrOptions.catalog("complaint-types")))
  const resolutionTypes = toSelect(useOptions("catalog:resolution-types", () => HrOptions.catalog("resolution-types")))
  const warningTypes = toSelect(useOptions("catalog:warning-types", () => HrOptions.catalog("warning-types")))
  const severities = toSelect(useOptions("catalog:warning-severities", () => HrOptions.catalog("warning-severities")))
  const is = (...s: string[]) => (r: Row) => s.includes(String(r.status))
  const person = (r: Row, p: string) => String(pick(r, `${p}.fullName`) ?? "-")

  const complaints: CrudConfig = {
    id: "complaints",
    load: HR.complaints.list,
    keyword: true,
    statuses: ["PENDING", "IN_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED"],
    columns: [
      { label: "hr.f.subject", path: "subject" },
      { label: "hr.f.complainant", render: (r) => (r.anonymous ? t("hr.anonymous") : person(r, "complainant")) },
      { label: "hr.f.against", render: (r) => person(r, "against") },
      { label: "hr.f.complaintType", path: "complaintType.name" },
      { label: "hr.f.date", path: "complaintDate", kind: "date" },
      { label: "hr.f.assignedTo", render: (r) => String(pick(r, "assignment.assignedTo.fullName") ?? "-") },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.subject ?? ""),
    createLabel: "hr.complaint.create",
    fields: [
      { name: "subject", label: "hr.f.subject", required: true, max: 200, full: true },
      { name: "complainantId", label: "hr.f.complainant", type: "select", required: true, numeric: true, options: employees },
      { name: "againstId", label: "hr.f.against", type: "select", numeric: true, none: true, options: employees },
      { name: "complaintTypeId", label: "hr.f.complaintType", type: "select", required: true, numeric: true, options: complaintTypes },
      { name: "complaintDate", label: "hr.f.date", type: "date", required: true },
      { name: "anonymous", label: "hr.anonymous", type: "switch" },
      { name: "documentMediaId", label: "hr.f.document", type: "file" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 5000 },
    ],
    toValues: (r) => ({ ...r, complainantId: pick(r, "complainant.id"), againstId: pick(r, "against.id"), complaintTypeId: pick(r, "complaintType.id"), documentMediaId: r.documentId, documentMediaId__name: pick(r, "document.name") }),
    save: HR.complaints.save,
    remove: HR.complaints.remove,
    canEdit: is("PENDING"),
    canDelete: is("PENDING"),
    actions: [
      { key: "review", label: "hr.complaint.review", icon: <Eye className="size-4" />, when: is("PENDING"), run: (r) => HR.complaints.put(r.id ?? "", "status", { status: "IN_REVIEW" }) },
      {
        key: "assign",
        label: "hr.complaint.assign",
        icon: <UserCheck className="size-4" />,
        when: is("PENDING", "IN_REVIEW", "ASSIGNED", "IN_PROGRESS"),
        fields: [
          { name: "assignedToId", label: "hr.f.assignedTo", type: "select", required: true, numeric: true, options: employees },
          { name: "resolutionDeadline", label: "hr.f.deadline", type: "date" },
        ],
        run: (r, b) => HR.complaints.put(r.id ?? "", "assign", b),
      },
      { key: "start", label: "hr.complaint.start", icon: <Play className="size-4" />, when: is("ASSIGNED"), run: (r) => HR.complaints.put(r.id ?? "", "status", { status: "IN_PROGRESS" }) },
      {
        key: "resolve",
        label: "hr.complaint.resolve",
        icon: <Check className="size-4" />,
        when: is("IN_REVIEW", "ASSIGNED", "IN_PROGRESS"),
        fields: [
          { name: "resolutionTypeId", label: "hr.f.resolutionType", type: "select", required: true, numeric: true, options: resolutionTypes },
          { name: "resolutionDate", label: "hr.f.resolutionDate", type: "date", required: true },
          { name: "investigationNotes", label: "hr.f.investigationNotes", type: "textarea", max: 5000 },
          { name: "resolutionAction", label: "hr.f.resolutionAction", type: "textarea", max: 5000 },
        ],
        run: (r, b) => HR.complaints.put(r.id ?? "", "resolve", b),
      },
      {
        key: "follow-up",
        label: "hr.complaint.followUp",
        icon: <Reply className="size-4" />,
        when: is("RESOLVED"),
        fields: [
          { name: "followUpAction", label: "hr.f.followUpAction", type: "textarea", max: 5000 },
          { name: "followUpDate", label: "hr.f.followUpDate", type: "date" },
          { name: "feedback", label: "hr.f.feedback", type: "textarea", max: 5000 },
        ],
        run: (r, b) => HR.complaints.put(r.id ?? "", "follow-up", b),
      },
    ],
    manage,
  }
  const planFields: FieldDef[] = [
    { name: "hasImprovementPlan", label: "hr.f.hasPlan", type: "switch" },
    { name: "startDate", label: "hr.f.startDate", type: "date", hidden: (v) => !v.hasImprovementPlan },
    { name: "endDate", label: "hr.f.endDate", type: "date", hidden: (v) => !v.hasImprovementPlan },
    { name: "goals", label: "hr.f.planGoals", type: "textarea", max: 5000, hidden: (v) => !v.hasImprovementPlan },
    { name: "progress", label: "hr.f.planProgress", type: "textarea", max: 5000, hidden: (v) => !v.hasImprovementPlan },
  ]
  const warnings: CrudConfig = {
    id: "warnings",
    load: HR.warnings.list,
    keyword: true,
    statuses: ["PENDING", "APPROVED", "REJECTED"],
    columns: [
      { label: "hr.f.subject", path: "subject" },
      { label: "hr.f.employee", render: (r) => person(r, "employee") },
      { label: "hr.f.warningType", path: "warningType.name" },
      { label: "hr.f.severity", path: "severity.name" },
      { label: "hr.f.date", path: "warningDate", kind: "date" },
      { label: "hr.f.employeeResponse", render: (r) => <span className="line-clamp-2 max-w-60">{String(r.employeeResponse ?? "-")}</span> },
      { label: "hr.f.status", render: (r) => <span>{r.expired ? t("hr.status.EXPIRED") : t(`hr.status.${String(r.status)}` as "hr.status.PENDING")}</span> },
    ],
    rowName: (r) => String(r.subject ?? ""),
    createLabel: "hr.warning.create",
    fields: [
      { name: "subject", label: "hr.f.subject", required: true, max: 200, full: true },
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "warnedById", label: "hr.f.warnedBy", type: "select", numeric: true, none: true, options: employees },
      { name: "warningTypeId", label: "hr.f.warningType", type: "select", required: true, numeric: true, options: warningTypes },
      { name: "severityId", label: "hr.f.severity", type: "select", required: true, numeric: true, options: severities },
      { name: "warningDate", label: "hr.f.date", type: "date", required: true },
      { name: "expiryDate", label: "hr.f.expiryDate", type: "date" },
      { name: "documentMediaId", label: "hr.f.document", type: "file" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 5000 },
    ],
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), warnedById: pick(r, "warnedBy.id"), warningTypeId: pick(r, "warningType.id"), severityId: pick(r, "severity.id"), documentMediaId: r.documentId, documentMediaId__name: pick(r, "document.name") }),
    save: HR.warnings.save,
    remove: HR.warnings.remove,
    canEdit: is("PENDING"),
    canDelete: is("PENDING"),
    actions: [
      { key: "approve", label: "hr.approve", icon: <ClipboardCheck className="size-4" />, when: is("PENDING"), run: (r) => HR.warnings.put(r.id ?? "", "status", { status: "APPROVED" }) },
      { key: "reject", label: "hr.reject", icon: <X className="size-4" />, when: is("PENDING"), destructive: true, run: (r) => HR.warnings.put(r.id ?? "", "status", { status: "REJECTED" }) },
      { key: "plan", label: "hr.warning.plan", icon: <Target className="size-4" />, when: is("PENDING", "APPROVED"), fields: planFields, run: (r, b) => HR.warnings.put(r.id ?? "", "improvement-plan", b) },
    ],
    manage,
  }
  return (
    <TabbedPage
      title={t("menu.hr.issues")}
      description={t("hr.issues.subtitle")}
      tabs={[
        { key: "complaints", label: "hr.complaints", content: () => <CrudSection config={complaints} /> },
        { key: "warnings", label: "hr.warnings", content: () => <CrudSection config={warnings} /> },
      ]}
    />
  )
}
