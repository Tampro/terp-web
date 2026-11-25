"use client"

import * as React from "react"
import { Ban, Check, MessageSquare, Play, X } from "lucide-react"

import { HR, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { useT } from "@/lib/i18n"

import { CrudSection, fileCol, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef, orgChain } from "../_components/crud-kit"

export default function CareerPage() {
  return (
    <React.Suspense>
      <Career />
    </React.Suspense>
  )
}

const exitFields: FieldDef[] = [
  { name: "exitInterviewConducted", label: "hr.f.exitConducted", type: "switch" },
  { name: "exitInterviewDate", label: "hr.f.exitDate", type: "date", hidden: (v) => !v.exitInterviewConducted },
  { name: "exitFeedback", label: "hr.f.exitFeedback", type: "textarea", max: 5000, hidden: (v) => !v.exitInterviewConducted },
]

/** §15 career changes: transfers (Pending, In Progress, Approved, Rejected, Cancelled), resignations (Pending → Accepted / Rejected), terminations (Pending → Approved / Rejected) with exit interview. */
function Career() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("LIFECYCLE_MANAGE")
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const departmentOpts = useOptions("departments", () => HrOptions.departments())
  const designationOpts = useOptions("designations", () => HrOptions.designations())
  const chain = orgChain(departmentOpts, designationOpts)
  const terminationTypes = toSelect(useOptions("catalog:termination-types", () => HrOptions.catalog("termination-types")))
  const is = (...s: string[]) => (r: Row) => s.includes(String(r.status))
  const docField: FieldDef = { name: "documentMediaId", label: "hr.f.document", type: "file" }
  const docValues = (r: Row) => ({ documentMediaId: r.documentId, documentMediaId__name: pick(r, "document.name") })
  const ref = (r: Row, p: string) => String(pick(r, `${p}.name`) ?? "")
  const exitCol = { label: "hr.f.exitInterview" as const, render: (r: Row) => (pick(r, "exitInterview.conducted") ? t("hr.yes") : "-") }

  const transfers: CrudConfig = {
    id: "transfers",
    load: HR.transfers.list,
    countsPath: "/v1/lifecycle/transfers/status-counts",
    keyword: true,
    statuses: ["PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED"],
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.from", render: (r) => [ref(r, "fromDesignation"), ref(r, "fromDepartment"), ref(r, "fromBranch")].filter(Boolean).join(" · ") || "-" },
      { label: "hr.f.to", render: (r) => [ref(r, "toDesignation"), ref(r, "toDepartment"), ref(r, "toBranch")].filter(Boolean).join(" · ") || "-" },
      { label: "hr.f.transferDate", path: "transferDate", kind: "date" },
      { label: "hr.f.effectiveDate", path: "effectiveDate", kind: "date" },
      { label: "hr.f.status", path: "status", kind: "status" },
      fileCol("hr.f.document", "document", HR.transfers.get),
    ],
    rowName: (r) => String(pick(r, "employee.fullName") ?? ""),
    createLabel: "hr.transfer.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees, full: true },
      { name: "toBranchId", label: "hr.f.toBranch", type: "select", numeric: true, none: true, options: branches, resets: ["toDepartmentId"] },
      { name: "toDepartmentId", label: "hr.f.toDepartment", type: "select", numeric: true, none: true, optionsFor: chain.departmentsOf("toBranchId"), resets: ["toDesignationId"] },
      { name: "toDesignationId", label: "hr.f.toDesignation", type: "select", numeric: true, none: true, optionsFor: chain.designationsOf("toDepartmentId"), check: (v) => (!v.toBranchId && !v.toDepartmentId && !v.toDesignationId ? "hr.v.transferTarget" : undefined) },
      { name: "transferDate", label: "hr.f.transferDate", type: "date", required: true },
      { name: "effectiveDate", label: "hr.f.effectiveDate", type: "date", required: true },
      docField,
      { name: "reason", label: "hr.f.reason", type: "textarea", max: 2000 },
    ],
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), toBranchId: pick(r, "toBranch.id"), toDepartmentId: pick(r, "toDepartment.id"), toDesignationId: pick(r, "toDesignation.id"), ...docValues(r) }),
    save: HR.transfers.save,
    remove: HR.transfers.remove,
    canEdit: is("PENDING"),
    canDelete: is("PENDING"),
    actions: [
      { key: "start", label: "hr.transfer.start", icon: <Play className="size-4" />, when: is("PENDING"), run: (r) => HR.transfers.put(r.id ?? "", "start") },
      { key: "approve", label: "hr.approve", icon: <Check className="size-4" />, when: is("PENDING", "IN_PROGRESS"), confirmDesc: "hr.transfer.approveDesc", run: (r) => HR.transfers.put(r.id ?? "", "approve") },
      { key: "reject", label: "hr.reject", icon: <X className="size-4" />, when: is("PENDING", "IN_PROGRESS"), destructive: true, run: (r) => HR.transfers.put(r.id ?? "", "reject") },
      { key: "cancel", label: "hr.cancelRequest", icon: <Ban className="size-4" />, when: is("PENDING", "IN_PROGRESS"), destructive: true, run: (r) => HR.transfers.put(r.id ?? "", "cancel") },
    ],
    manage,
  }
  const resignations: CrudConfig = {
    id: "resignations",
    load: HR.resignations.list,
    countsPath: "/v1/lifecycle/resignations/status-counts",
    keyword: true,
    statuses: ["PENDING", "ACCEPTED", "REJECTED"],
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.resignationDate", path: "resignationDate", kind: "date" },
      { label: "hr.f.lastWorkingDay", path: "lastWorkingDay", kind: "date" },
      { label: "hr.f.noticePeriod", path: "noticePeriod" },
      { label: "hr.f.reason", path: "reason" },
      exitCol,
      { label: "hr.f.status", path: "status", kind: "status" },
      fileCol("hr.f.document", "document", HR.resignations.get),
    ],
    rowName: (r) => String(pick(r, "employee.fullName") ?? ""),
    createLabel: "hr.resignation.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees, full: true },
      { name: "resignationDate", label: "hr.f.resignationDate", type: "date", required: true },
      { name: "lastWorkingDay", label: "hr.f.lastWorkingDay", type: "date", check: (v) => (v.lastWorkingDay && v.resignationDate && String(v.lastWorkingDay) < String(v.resignationDate) ? "hr.v.afterResignation" : undefined) },
      { name: "noticePeriod", label: "hr.f.noticePeriod", max: 50 },
      { name: "reason", label: "hr.f.reason", max: 500 },
      docField,
      { name: "description", label: "hr.f.description", type: "textarea", max: 5000 },
    ],
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), ...docValues(r) }),
    save: HR.resignations.save,
    remove: HR.resignations.remove,
    canEdit: is("PENDING"),
    canDelete: is("PENDING"),
    actions: [
      { key: "accept", label: "hr.accept", icon: <Check className="size-4" />, when: is("PENDING"), fields: exitFields, confirmDesc: "hr.resignation.acceptDesc", run: (r, b) => HR.resignations.put(r.id ?? "", "status", { ...b, status: "ACCEPTED" }) },
      { key: "reject", label: "hr.reject", icon: <X className="size-4" />, when: is("PENDING"), destructive: true, run: (r) => HR.resignations.put(r.id ?? "", "status", { status: "REJECTED", exitInterviewConducted: false }) },
      { key: "exit", label: "hr.exitInterview", icon: <MessageSquare className="size-4" />, when: is("ACCEPTED"), fields: exitFields, run: (r, b) => HR.resignations.put(r.id ?? "", "exit-interview", b) },
    ],
    manage,
  }
  const terminations: CrudConfig = {
    id: "terminations",
    load: HR.terminations.list,
    countsPath: "/v1/lifecycle/terminations/status-counts",
    keyword: true,
    statuses: ["PENDING", "APPROVED", "REJECTED"],
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.terminationType", path: "terminationType.name" },
      { label: "hr.f.noticeDate", path: "noticeDate", kind: "date" },
      { label: "hr.f.terminationDate", path: "terminationDate", kind: "date" },
      { label: "hr.f.reason", path: "reason" },
      exitCol,
      { label: "hr.f.status", path: "status", kind: "status" },
      fileCol("hr.f.document", "document", HR.terminations.get),
    ],
    rowName: (r) => String(pick(r, "employee.fullName") ?? ""),
    createLabel: "hr.termination.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "terminationTypeId", label: "hr.f.terminationType", type: "select", required: true, numeric: true, options: terminationTypes },
      { name: "noticeDate", label: "hr.f.noticeDate", type: "date" },
      { name: "terminationDate", label: "hr.f.terminationDate", type: "date", required: true, check: (v) => (v.noticeDate && v.terminationDate && String(v.terminationDate) < String(v.noticeDate) ? "hr.v.afterNotice" : undefined) },
      { name: "noticePeriod", label: "hr.f.noticePeriod", max: 50 },
      { name: "reason", label: "hr.f.reason", max: 500 },
      docField,
      { name: "description", label: "hr.f.description", type: "textarea", max: 5000 },
    ],
    toValues: (r) => ({ ...r, employeeId: pick(r, "employee.id"), terminationTypeId: pick(r, "terminationType.id"), ...docValues(r) }),
    save: HR.terminations.save,
    remove: HR.terminations.remove,
    canEdit: is("PENDING"),
    canDelete: is("PENDING"),
    actions: [
      { key: "approve", label: "hr.approve", icon: <Check className="size-4" />, when: is("PENDING"), fields: exitFields, confirmDesc: "hr.termination.approveDesc", run: (r, b) => HR.terminations.put(r.id ?? "", "status", { ...b, status: "APPROVED" }) },
      { key: "reject", label: "hr.reject", icon: <X className="size-4" />, when: is("PENDING"), destructive: true, run: (r) => HR.terminations.put(r.id ?? "", "status", { status: "REJECTED", exitInterviewConducted: false }) },
      { key: "exit", label: "hr.exitInterview", icon: <MessageSquare className="size-4" />, when: is("APPROVED"), fields: exitFields, run: (r, b) => HR.terminations.put(r.id ?? "", "exit-interview", b) },
    ],
    manage,
  }
  return (
    <TabbedPage
      title={t("menu.hr.career")}
      description={t("hr.career.subtitle")}
      tabs={[
        { key: "transfers", label: "hr.transfers", content: () => <CrudSection config={transfers} /> },
        { key: "resignations", label: "hr.resignations", content: () => <CrudSection config={resignations} /> },
        { key: "terminations", label: "hr.terminations", content: () => <CrudSection config={terminations} /> },
      ]}
    />
  )
}
