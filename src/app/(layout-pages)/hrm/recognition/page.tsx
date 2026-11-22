"use client"

import * as React from "react"
import { Check, X } from "lucide-react"

import { HR, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { useT } from "@/lib/i18n"

import { CrudSection, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig } from "../_components/crud-kit"

export default function RecognitionPage() {
  return (
    <React.Suspense>
      <Recognition />
    </React.Suspense>
  )
}

/** §15 recognition: awards and promotions (Pending → Approved / Rejected; approving moves the employee). */
function Recognition() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("LIFECYCLE_MANAGE")
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const awardTypes = toSelect(useOptions("awardTypes", HrOptions.awardTypes))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const departments = toSelect(useOptions("departments", () => HrOptions.departments()))
  const designations = toSelect(useOptions("designations", () => HrOptions.designations()))
  const pending = (r: Row) => r.status === "PENDING"

  const awards: CrudConfig = {
    id: "awards",
    load: HR.awards.list,
    keyword: true,
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.awardType", path: "awardType.name" },
      { label: "hr.f.awardDate", path: "awardDate", kind: "date" },
      { label: "hr.f.gift", path: "gift" },
      { label: "hr.f.description", render: (r) => <span className="line-clamp-2 max-w-72">{String(r.description ?? "-")}</span> },
    ],
    rowName: (r) => `${String(pick(r, "employee.fullName") ?? "")} · ${String(pick(r, "awardType.name") ?? "")}`,
    createLabel: "hr.award.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "awardTypeId", label: "hr.f.awardType", type: "select", required: true, numeric: true, options: awardTypes },
      { name: "awardDate", label: "hr.f.awardDate", type: "date", required: true },
      { name: "gift", label: "hr.f.gift", max: 255 },
      { name: "certificateMediaId", label: "hr.f.certificate", type: "file" },
      { name: "photoMediaId", label: "hr.f.photo", type: "file" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 2000 },
    ],
    toValues: (r) => ({
      ...r,
      employeeId: pick(r, "employee.id"),
      awardTypeId: pick(r, "awardType.id"),
      certificateMediaId: pick(r, "certificate.id"),
      certificateMediaId__name: pick(r, "certificate.name"),
      photoMediaId: pick(r, "photo.id"),
      photoMediaId__name: pick(r, "photo.name"),
    }),
    save: HR.awards.save,
    remove: HR.awards.remove,
    manage,
  }
  const promotions: CrudConfig = {
    id: "promotions",
    load: HR.promotions.list,
    keyword: true,
    statuses: ["PENDING", "APPROVED", "REJECTED"],
    columns: [
      { label: "hr.f.employee", path: "employee.fullName" },
      { label: "hr.f.previousDesignation", path: "previousDesignation" },
      { label: "hr.f.newDesignation", render: (r) => [pick(r, "newDesignation.name"), pick(r, "newDepartment.name"), pick(r, "newBranch.name")].filter(Boolean).join(" · ") || "-" },
      { label: "hr.f.promotionDate", path: "promotionDate", kind: "date" },
      { label: "hr.f.effectiveDate", path: "effectiveDate", kind: "date" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(pick(r, "employee.fullName") ?? ""),
    createLabel: "hr.promotion.create",
    fields: [
      { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
      { name: "previousDesignation", label: "hr.f.previousDesignation", max: 150 },
      { name: "newDesignationId", label: "hr.f.newDesignation", type: "select", required: true, numeric: true, options: designations },
      { name: "newDepartmentId", label: "hr.f.newDepartment", type: "select", numeric: true, none: true, options: departments },
      { name: "newBranchId", label: "hr.f.newBranch", type: "select", numeric: true, none: true, options: branches },
      { name: "promotionDate", label: "hr.f.promotionDate", type: "date", required: true },
      { name: "effectiveDate", label: "hr.f.effectiveDate", type: "date", required: true },
      { name: "documentMediaId", label: "hr.f.document", type: "file" },
      { name: "reason", label: "hr.f.reason", type: "textarea", max: 2000 },
    ],
    toValues: (r) => ({
      ...r,
      employeeId: pick(r, "employee.id"),
      newDesignationId: pick(r, "newDesignation.id"),
      newDepartmentId: pick(r, "newDepartment.id"),
      newBranchId: pick(r, "newBranch.id"),
      documentMediaId: pick(r, "document.id") ?? r.documentId,
      documentMediaId__name: pick(r, "document.name"),
    }),
    save: HR.promotions.save,
    remove: HR.promotions.remove,
    canEdit: pending,
    canDelete: pending,
    actions: [
      { key: "approve", label: "hr.approve", icon: <Check className="size-4" />, when: pending, confirmDesc: "hr.promotion.approveDesc", run: (r) => HR.promotions.put(r.id ?? "", "status", { status: "APPROVED" }) },
      { key: "reject", label: "hr.reject", icon: <X className="size-4" />, when: pending, destructive: true, run: (r) => HR.promotions.put(r.id ?? "", "status", { status: "REJECTED" }) },
    ],
    manage,
  }
  return (
    <TabbedPage
      title={t("menu.hr.recognition")}
      description={t("hr.recognition.subtitle")}
      tabs={[
        { key: "awards", label: "hr.awards", content: () => <CrudSection config={awards} /> },
        { key: "promotions", label: "hr.promotions", content: () => <CrudSection config={promotions} /> },
      ]}
    />
  )
}
