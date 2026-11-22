"use client"

import * as React from "react"
import { Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, EmployeeService, HrOptions, type EmployeeDetail, type ProfileForm } from "@/lib/hrm/hrm.service"
import { useT, type TranslationKey } from "@/lib/i18n"
import { MediaService } from "@/lib/media/media.service"

import { attempt, errorMessage, fieldErrors, FormFields, PlainSelect, toBody, toSelect, today, useOptions, type FieldDef, type Values } from "../../_components/crud-kit"

type Doc = { key: number; documentTypeId: string; fileId?: string; fileName?: string; expiryDate: string }
let docKey = 0

/** §15 employee form in 6 steps: personal, employment, contact & emergency, banking & tax, hours & rates, documents (create only). */
export function EmployeeWizard({ employee, onClose, onSaved }: { employee?: EmployeeDetail; onClose: () => void; onSaved: (id?: string) => void }) {
  const t = useT()
  const opt = (prefix: string, list: readonly string[]) => list.map((x) => ({ value: x, label: t(`${prefix}.${x}` as TranslationKey) }))
  const [values, setValues] = React.useState<Values>(() => ({
    fullName: employee?.fullName ?? "",
    employeeCode: employee?.employeeCode ?? "",
    dateOfBirth: employee?.dateOfBirth ?? "",
    gender: employee?.gender ?? "",
    phone: employee?.phone ?? "",
    email: employee?.email ?? "",
    password: "",
    shiftId: employee?.shiftId ?? "",
    dateOfJoining: employee?.dateOfJoining ?? today(),
    employmentType: employee?.employmentType ?? "FULL_TIME",
    status: employee?.status ?? "ACTIVE",
    branchId: employee?.branch?.id ?? "",
    departmentId: employee?.department?.id ?? "",
    designationId: employee?.designation?.id ?? "",
    addressLine1: employee?.addressLine1 ?? "",
    addressLine2: employee?.addressLine2 ?? "",
    city: employee?.city ?? "",
    state: employee?.state ?? "",
    country: employee?.country ?? "",
    postalCode: employee?.postalCode ?? "",
    emergencyName: employee?.emergencyName ?? "",
    emergencyRelationship: employee?.emergencyRelationship ?? "",
    emergencyPhone: employee?.emergencyPhone ?? "",
    bankName: employee?.banking?.bankName ?? "",
    accountHolderName: employee?.banking?.accountHolderName ?? "",
    accountNumber: employee?.banking?.accountNumber ?? "",
    bankIdentifierCode: employee?.banking?.bankIdentifierCode ?? "",
    bankBranch: employee?.banking?.bankBranch ?? "",
    taxPayerId: employee?.banking?.taxPayerId ?? "",
    baseSalary: employee?.banking?.baseSalary != null ? String(employee.banking.baseSalary) : "",
    hoursPerDay: employee?.banking?.hoursPerDay != null ? String(employee.banking.hoursPerDay) : "",
    daysPerWeek: employee?.banking?.daysPerWeek != null ? String(employee.banking.daysPerWeek) : "",
    ratePerHour: employee?.banking?.ratePerHour != null ? String(employee.banking.ratePerHour) : "",
  }))
  const branchId = String(values.branchId ?? "")
  const departmentId = String(values.departmentId ?? "")
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const departments = toSelect(useOptions(`departments:${branchId}`, () => HrOptions.departments(branchId), !!branchId))
  const designations = toSelect(useOptions(`designations:${departmentId}`, () => HrOptions.designations(departmentId), !!departmentId))
  const shifts = toSelect(useOptions("shifts", HrOptions.shifts))
  const docTypes = toSelect(useOptions("documentTypes", HrOptions.documentTypes))
  const [docs, setDocs] = React.useState<Doc[]>([])
  const [uploading, setUploading] = React.useState<number>()
  const [step, setStep] = React.useState(0)
  const [saving, setSaving] = React.useState(false)

  const steps: { title: TranslationKey; fields: FieldDef[] }[] = [
    {
      title: "hr.emp.step.personal",
      fields: [
        { name: "fullName", label: "hr.f.fullName", required: true, max: 255, full: true },
        { name: "employeeCode", label: "hr.f.employeeCode", max: 50, pattern: /^[A-Za-z0-9._-]*$/, patternMsg: "hr.v.code" },
        { name: "dateOfBirth", label: "hr.f.dateOfBirth", type: "date", check: (v) => (v.dateOfBirth && String(v.dateOfBirth) >= today() ? "hr.v.past" : undefined) },
        { name: "gender", label: "hr.f.gender", type: "select", none: true, options: opt("hr.gender", ["MALE", "FEMALE", "OTHER"]) },
        { name: "phone", label: "hr.f.phone", max: 30 },
      ],
    },
    {
      title: "hr.emp.step.employment",
      fields: [
        ...(employee
          ? []
          : ([
              { name: "email", label: "hr.f.loginEmail", type: "email", required: true, max: 100, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
              { name: "password", label: "hr.f.password", type: "password", max: 128, check: (v) => (v.password && String(v.password).length < 8 ? "hr.v.password" : undefined) },
            ] satisfies FieldDef[])),
        { name: "dateOfJoining", label: "hr.f.dateOfJoining", type: "date", required: true },
        { name: "employmentType", label: "hr.f.employmentType", type: "select", required: true, options: opt("hr.type", EMPLOYMENT_TYPES) },
        { name: "status", label: "hr.f.status", type: "select", required: true, options: opt("hr.status", EMPLOYEE_STATUSES) },
        { name: "shiftId", label: "hr.f.shift", type: "select", numeric: true, none: true, options: shifts },
        { name: "branchId", label: "hr.f.branch", type: "select", numeric: true, none: true, options: branches },
        { name: "departmentId", label: "hr.f.department", type: "select", numeric: true, none: true, options: departments, hidden: (v) => !v.branchId },
        { name: "designationId", label: "hr.f.designation", type: "select", numeric: true, none: true, options: designations, hidden: (v) => !v.departmentId },
      ],
    },
    {
      title: "hr.emp.step.contact",
      fields: [
        { name: "addressLine1", label: "hr.f.addressLine1", max: 255, full: true },
        { name: "addressLine2", label: "hr.f.addressLine2", max: 255, full: true },
        { name: "city", label: "hr.f.city", max: 100 },
        { name: "state", label: "hr.f.state", max: 100 },
        { name: "country", label: "hr.f.country", max: 100 },
        { name: "postalCode", label: "hr.f.postalCode", max: 20 },
        { name: "emergencyName", label: "hr.f.emergencyName", max: 255 },
        { name: "emergencyRelationship", label: "hr.f.emergencyRelationship", max: 50 },
        { name: "emergencyPhone", label: "hr.f.emergencyPhone", max: 30 },
      ],
    },
    {
      title: "hr.emp.step.banking",
      fields: [
        { name: "bankName", label: "hr.f.bankName", max: 150 },
        { name: "accountHolderName", label: "hr.f.accountHolderName", max: 255 },
        { name: "accountNumber", label: "hr.f.accountNumber", max: 50 },
        { name: "bankIdentifierCode", label: "hr.f.bankIdentifierCode", max: 20 },
        { name: "bankBranch", label: "hr.f.bankBranch", max: 150 },
        { name: "taxPayerId", label: "hr.f.taxPayerId", max: 50 },
      ],
    },
    {
      title: "hr.emp.step.hours",
      fields: [
        { name: "baseSalary", label: "hr.f.baseSalary", type: "number", min: 0 },
        { name: "hoursPerDay", label: "hr.f.hoursPerDay", type: "number", min: 0, max: 24 },
        { name: "daysPerWeek", label: "hr.f.daysPerWeek", type: "number", min: 0, max: 7, check: (v) => (v.daysPerWeek && !Number.isInteger(Number(v.daysPerWeek)) ? "hr.v.integer" : undefined) },
        { name: "ratePerHour", label: "hr.f.ratePerHour", type: "number", min: 0 },
      ],
    },
  ]
  const totalSteps = employee ? steps.length : steps.length + 1
  const current = steps[step]
  const errors = current ? fieldErrors(current.fields, values, t) : {}
  const stepValid = !Object.values(errors).some(Boolean)
  const docsValid = docs.every((d) => d.documentTypeId && d.fileId)
  const last = step === totalSteps - 1

  function onChange(v: Values) {
    // the branch → department → designation chain resets below a changed level
    if (v.branchId !== values.branchId) v = { ...v, departmentId: "", designationId: "" }
    else if (v.departmentId !== values.departmentId) v = { ...v, designationId: "" }
    setValues(v)
  }

  async function save() {
    const all = steps.flatMap((s) => s.fields)
    const b = toBody(all, values)
    const banking = Object.fromEntries(["bankName", "accountHolderName", "accountNumber", "bankIdentifierCode", "bankBranch", "taxPayerId", "baseSalary", "hoursPerDay", "daysPerWeek", "ratePerHour"].filter((k) => k in b).map((k) => [k, b[k]]))
    const profile = Object.fromEntries(Object.entries(b).filter(([k]) => !(k in banking) && k !== "email" && k !== "password")) as unknown as ProfileForm
    if (Object.keys(banking).length) profile.banking = banking
    setSaving(true)
    let id = employee?.id
    const ok = await attempt(async () => {
      if (employee?.id) await EmployeeService.update(employee.id, profile)
      else {
        const created = await EmployeeService.create({
          email: String(b.email),
          password: b.password ? String(b.password) : undefined,
          profile,
          documents: docs.map((d) => ({ documentTypeId: Number(d.documentTypeId), fileId: Number(d.fileId), expiryDate: d.expiryDate || undefined })),
        })
        id = created.id
      }
    }, t("common.saved"))
    setSaving(false)
    if (ok) {
      onSaved(id)
      onClose()
    }
  }

  async function upload(key: number, file?: File) {
    if (!file) return
    setUploading(key)
    try {
      const [f] = await MediaService.upload([file])
      setDocs((ds) => ds.map((d) => (d.key === key ? { ...d, fileId: f?.id, fileName: f?.originalName ?? f?.displayName ?? file.name } : d)))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(undefined)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{employee ? t("hr.emp.edit", { name: employee.fullName ?? "" }) : t("hr.emp.create")}</DialogTitle>
        <DialogDescription>
          {t("hr.emp.stepOf", { n: step + 1, total: totalSteps })}: {t(current?.title ?? "hr.emp.step.documents")}
          {!employee && step === 0 && ` · ${t("hr.emp.autoId")}`}
        </DialogDescription>
      </DialogHeader>
      {current ? (
        <FormFields key={step} fields={current.fields} values={values} onChange={onChange} errors={errors} prefix="emp" />
      ) : (
        <div className="grid gap-3">
          <p className="text-muted-foreground text-sm">{t("hr.emp.documentsHint")}</p>
          {docs.map((d, i) => (
            <div key={d.key} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
              <PlainSelect label={t("hr.f.documentType")} className="w-48" value={d.documentTypeId} onChange={(v) => setDocs((ds) => ds.map((x) => (x.key === d.key ? { ...x, documentTypeId: v } : x)))} options={docTypes} />
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Upload className="size-4" /> {uploading === d.key ? t("hr.uploading") : (d.fileName ?? t("hr.chooseFile"))}
                <input type="file" className="sr-only" aria-label={t("hr.documentFile", { n: i + 1 })} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => upload(d.key, e.target.files?.[0])} />
              </label>
              <Input type="date" className="w-40" aria-label={t("hr.f.expiryDate")} value={d.expiryDate} onChange={(e) => setDocs((ds) => ds.map((x) => (x.key === d.key ? { ...x, expiryDate: e.target.value } : x)))} />
              <Button variant="ghost" size="icon" aria-label={t("hr.removeDocument", { n: i + 1 })} onClick={() => setDocs((ds) => ds.filter((x) => x.key !== d.key))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-fit" onClick={() => setDocs((ds) => [...ds, { key: ++docKey, documentTypeId: "", expiryDate: "" }])}>
            {t("hr.addDocument")}
          </Button>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}>
          {step === 0 ? t("common.cancel") : t("hr.back")}
        </Button>
        {last ? (
          <Button key="save" disabled={saving || !stepValid || !docsValid || uploading !== undefined} onClick={save}>
            {t("common.save")}
          </Button>
        ) : (
          <Button key="next" disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
            {t("hr.next")}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
