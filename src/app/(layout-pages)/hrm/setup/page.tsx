"use client"

import * as React from "react"

import { useUrlQuery } from "@/hooks/use-url-query"
import { HR, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { CrudSection, PlainSelect, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../_components/crud-kit"

const ACTIVE = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
]
const CATALOGS = ["warning-types", "warning-severities", "termination-types", "complaint-types", "resolution-types", "expense-types"] as const
const PAYROLL_KINDS = ["ALLOWANCE", "DEDUCTION", "LOAN"] as const
const name = (r: Row) => String(r.name ?? r.title ?? r.id ?? "")
const hex = /^#[0-9A-Fa-f]{6}$/

export default function HrmSetupPage() {
  return (
    <React.Suspense>
      <Setup />
    </React.Suspense>
  )
}

/** §15 Setup: branches, departments, designations, document types, award types, lifecycle types, holiday / announcement categories, allowance / deduction / loan types. */
function Setup() {
  const t = useT()
  const perms = useAuthStore((s) => s.me?.permissions) ?? []
  const org = perms.includes("ORG_MANAGE")
  const life = perms.includes("LIFECYCLE_MANAGE")
  const pay = perms.includes("PAYROLL_MANAGE")
  const ann = perms.includes("ANNOUNCEMENT_MANAGE")
  const statusOptions = ACTIVE.map((o) => ({ value: o.value, label: t(`hr.status.${o.value}` as TranslationKey) }))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const departments = toSelect(useOptions("departments", () => HrOptions.departments()))
  const status: FieldDef = { name: "status", label: "hr.f.status", type: "select", options: statusOptions }

  const branchCfg: CrudConfig = {
    id: "branches",
    load: HR.branches.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.city", path: "city" },
      { label: "hr.f.phone", path: "phone" },
      { label: "hr.departments", path: "departmentCount" },
      { label: "hr.employees", path: "employeeCount" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "hr.branch.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150, full: true },
      { name: "address", label: "hr.f.address", max: 255, full: true },
      { name: "city", label: "hr.f.city", max: 100 },
      { name: "state", label: "hr.f.state", max: 100 },
      { name: "country", label: "hr.f.country", max: 100 },
      { name: "postalCode", label: "hr.f.postalCode", max: 20 },
      { name: "phone", label: "hr.f.phone", max: 30 },
      { name: "email", label: "hr.f.email", type: "email", max: 255 },
      status,
    ],
    defaults: { status: "ACTIVE" },
    save: HR.branches.save,
    remove: HR.branches.remove,
    invalidates: true,
    manage: org,
  }
  const departmentCfg: CrudConfig = {
    id: "departments",
    load: HR.departments.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.branch", path: "branch.name" },
      { label: "hr.designations", path: "designationCount" },
      { label: "hr.employees", path: "employeeCount" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "hr.department.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "branchId", label: "hr.f.branch", type: "select", required: true, numeric: true, options: branches },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
      status,
    ],
    defaults: { status: "ACTIVE" },
    toValues: (r) => ({ ...r, branchId: pick(r, "branch.id") }),
    save: HR.departments.save,
    remove: HR.departments.remove,
    invalidates: true,
    manage: org,
  }
  const designationCfg: CrudConfig = {
    id: "designations",
    load: HR.designations.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.department", path: "department.name" },
      { label: "hr.f.branch", path: "branch.name" },
      { label: "hr.employees", path: "employeeCount" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "hr.designation.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "departmentId", label: "hr.f.department", type: "select", required: true, numeric: true, options: departments },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
      status,
    ],
    defaults: { status: "ACTIVE" },
    toValues: (r) => ({ ...r, departmentId: pick(r, "department.id") }),
    save: HR.designations.save,
    remove: HR.designations.remove,
    invalidates: true,
    manage: org,
  }
  const documentTypeCfg: CrudConfig = {
    id: "document-types",
    load: HR.documentTypes.list,
    keyword: true,
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.description", path: "description" },
      { label: "hr.f.required", path: "required", kind: "bool" },
    ],
    rowName: name,
    createLabel: "hr.documentType.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "required", label: "hr.f.required", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
    ],
    save: HR.documentTypes.save,
    remove: HR.documentTypes.remove,
    canDelete: (r) => !r.system,
    canEdit: (r) => !r.system,
    invalidates: true,
    manage: org,
  }
  const awardTypeCfg: CrudConfig = {
    id: "award-types",
    load: HR.awardTypes.list,
    keyword: true,
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.description", path: "description" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "hr.awardType.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "icon", label: "hr.f.icon", max: 50, pattern: /^[a-z0-9-]*$/, patternMsg: "hr.v.icon" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
      status,
    ],
    defaults: { status: "ACTIVE" },
    save: HR.awardTypes.save,
    remove: HR.awardTypes.remove,
    invalidates: true,
    manage: org,
  }
  const categoryCfg = (id: string, api: typeof HR.holidayCategories, manage: boolean): CrudConfig => ({
    id,
    load: () => api.list(),
    columns: [
      { label: "hr.f.color", path: "color", kind: "color" },
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.system", path: "system", kind: "bool" },
    ],
    rowName: name,
    createLabel: "hr.category.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 100 },
      { name: "color", label: "hr.f.color", type: "color", required: true, pattern: hex },
    ],
    save: api.save,
    remove: api.remove,
    canEdit: (r) => !r.system,
    canDelete: (r) => !r.system,
    invalidates: true,
    manage,
  })

  return (
    <TabbedPage
      title={t("menu.hr.setup")}
      description={t("hr.setup.subtitle")}
      tabs={[
        { key: "branches", label: "hr.branches", content: () => <CrudSection config={branchCfg} /> },
        { key: "departments", label: "hr.departments", content: () => <CrudSection config={departmentCfg} /> },
        { key: "designations", label: "hr.designations", content: () => <CrudSection config={designationCfg} /> },
        { key: "document-types", label: "hr.documentTypes", content: () => <CrudSection config={documentTypeCfg} /> },
        { key: "award-types", label: "hr.awardTypes", content: () => <CrudSection config={awardTypeCfg} /> },
        { key: "lifecycle", label: "hr.lifecycleTypes", content: () => <CatalogTab manage={life} /> },
        { key: "holiday-categories", label: "hr.holidayCategories", content: () => <CrudSection config={categoryCfg("holiday-categories", HR.holidayCategories, org)} /> },
        { key: "announcement-categories", label: "hr.announcementCategories", content: () => <CrudSection config={categoryCfg("announcement-categories", HR.announcementCategories, ann)} /> },
        { key: "payroll-types", label: "hr.payrollTypes", content: () => <PayrollTypesTab manage={pay} /> },
      ]}
    />
  )
}

/** Warning types / severities, termination, complaint, resolution and expense types: /lifecycle/catalogs/{slug}. */
function CatalogTab({ manage }: { manage: boolean }) {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const kind = CATALOGS.find((k) => k === searchParams.get("kind")) ?? CATALOGS[0]
  const api = HR.catalog(kind)
  const cfg: CrudConfig = {
    id: `catalog-${kind}`,
    load: api.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.description", path: "description" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: name,
    createLabel: "hr.catalog.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "status", label: "hr.f.status", type: "select", options: ACTIVE.map((o) => ({ value: o.value, label: t(`hr.status.${o.value}` as TranslationKey) })) },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
    ],
    defaults: { status: "ACTIVE" },
    save: api.save,
    remove: api.remove,
    invalidates: true,
    manage,
    toolbar: (
      <PlainSelect label={t("hr.catalogKind")} className="w-52" value={kind} onChange={(v) => update({ kind: v, page: 0, status: "", q: "" })} options={CATALOGS.map((k) => ({ value: k, label: t(`hr.catalog.${k}`) }))} />
    ),
  }
  return <CrudSection config={cfg} />
}

/** Allowance, deduction and loan types (payroll TypeForm {kind, name, code, active}). */
function PayrollTypesTab({ manage }: { manage: boolean }) {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const kind = PAYROLL_KINDS.find((k) => k === searchParams.get("kind")) ?? PAYROLL_KINDS[0]
  const cfg: CrudConfig = {
    id: `payroll-types-${kind}`,
    load: (q) => HR.payrollTypes.list({ ...q, kind }),
    keyword: true,
    columns: [
      { label: "hr.f.code", path: "code", kind: "mono" },
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.active", path: "active", kind: "bool" },
    ],
    rowName: name,
    createLabel: "hr.payrollType.create",
    fields: [
      { name: "code", label: "hr.f.code", required: true, max: 50 },
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "active", label: "hr.f.active", type: "switch" },
    ],
    defaults: { active: true },
    save: (id, body) => HR.payrollTypes.save(id, { ...body, kind }),
    remove: HR.payrollTypes.remove,
    invalidates: true,
    manage,
    toolbar: (
      <PlainSelect label={t("hr.payrollKind")} className="w-44" value={kind} onChange={(v) => update({ kind: v, page: 0, q: "" })} options={PAYROLL_KINDS.map((k) => ({ value: k, label: t(`hr.payrollKind.${k}`) }))} />
    ),
  }
  return <CrudSection config={cfg} />
}
