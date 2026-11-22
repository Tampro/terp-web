"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, BadgeCheck, Pencil, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { EMPLOYEE_STATUSES, EmployeeService, HrOptions, type EmployeeDetail } from "@/lib/hrm/hrm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { MediaService } from "@/lib/media/media.service"

import { attempt, errorMessage, HrStatus, PlainSelect, toSelect, useAuthStore, useOptions } from "../../_components/crud-kit"
import { EmployeeWizard } from "../_components/employee-wizard"

/** §15 employee detail: profile, employment, contact, banking & hours, status, login, documents (add, verify, delete). */
export default function EmployeeDetailPage() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const perms = useAuthStore((s) => s.me?.permissions) ?? []
  const canUpdate = perms.includes("EMPLOYEE_UPDATE")
  const canDelete = perms.includes("EMPLOYEE_DELETE")
  const [emp, setEmp] = React.useState<EmployeeDetail | null>()
  const [key, setKey] = React.useState(0)
  const [editing, setEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [doc, setDoc] = React.useState({ documentTypeId: "", fileId: "", fileName: "", expiryDate: "" })
  const docTypes = toSelect(useOptions("documentTypes", HrOptions.documentTypes))
  const reload = () => setKey((x) => x + 1)

  React.useEffect(() => {
    let cancelled = false
    EmployeeService.get(id)
      .then((e) => !cancelled && setEmp(e))
      .catch((e: Error) => {
        if (cancelled) return
        toast.error(e.message)
        setEmp(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, key])

  if (emp === undefined) return <Skeleton className="m-6 h-64" />
  if (emp === null)
    return (
      <div className="p-6">
        <Link href="/hrm/employees" className="text-sm underline">
          {t("hr.backToList")}
        </Link>
      </div>
    )
  const b = emp.banking ?? {}
  const info = (rows: [TranslationKey, React.ReactNode][]) => (
    <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{t(k)}</dt>
          <dd>{v || "-"}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/hrm/employees" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
            <ArrowLeft className="size-4" /> {t("hr.backToList")}
          </Link>
          <h1 className="text-2xl font-semibold">{emp.fullName}</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-mono">{emp.employeeNo}</span> · {emp.email} · <HrStatus status={emp.status} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <>
              <PlainSelect
                label={t("hr.changeStatus")}
                className="w-40"
                value={emp.status ?? ""}
                onChange={async (v) => (await attempt(() => EmployeeService.status(id, v), t("common.saved"))) && reload()}
                options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: t(`hr.status.${s}`) }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!emp.loginEnabled} onCheckedChange={async (c) => (await attempt(() => EmployeeService.login(id, c), t("common.saved"))) && reload()} aria-label={t("hr.loginEnabled")} />
                {t("hr.loginEnabled")}
              </label>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> {t("common.edit")}
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2 className="size-4" /> {t("common.delete")}
            </Button>
          )}
        </div>
      </div>
      {!!emp.missingRequiredDocuments?.length && (
        <p className="text-destructive text-sm">{t("hr.emp.missingDocs", { list: emp.missingRequiredDocuments.map((d) => d.name).join(", ") })}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.emp.step.personal")}</CardTitle>
          </CardHeader>
          <CardContent>
            {info([
              ["hr.f.employeeCode", emp.employeeCode],
              ["hr.f.dateOfBirth", formatDate(emp.dateOfBirth, language)],
              ["hr.f.gender", emp.gender ? t(`hr.gender.${emp.gender}`) : ""],
              ["hr.f.phone", emp.phone],
            ])}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.emp.step.employment")}</CardTitle>
          </CardHeader>
          <CardContent>
            {info([
              ["hr.f.employmentType", emp.employmentType ? t(`hr.type.${emp.employmentType}` as TranslationKey) : ""],
              ["hr.f.dateOfJoining", formatDate(emp.dateOfJoining, language)],
              ["hr.f.branch", emp.branch?.name],
              ["hr.f.department", emp.department?.name],
              ["hr.f.designation", emp.designation?.name],
            ])}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.emp.step.contact")}</CardTitle>
          </CardHeader>
          <CardContent>
            {info([
              ["hr.f.address", [emp.addressLine1, emp.addressLine2, emp.city, emp.state, emp.country, emp.postalCode].filter(Boolean).join(", ")],
              ["hr.f.emergencyName", [emp.emergencyName, emp.emergencyRelationship].filter(Boolean).join(" · ")],
              ["hr.f.emergencyPhone", emp.emergencyPhone],
            ])}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.emp.bankingHours")}</CardTitle>
          </CardHeader>
          <CardContent>
            {info([
              ["hr.f.bankName", [b.bankName, b.bankBranch].filter(Boolean).join(" · ")],
              ["hr.f.accountNumber", [b.accountNumber, b.accountHolderName].filter(Boolean).join(" · ")],
              ["hr.f.taxPayerId", b.taxPayerId],
              ["hr.f.baseSalary", b.baseSalary != null ? money(b.baseSalary) : ""],
              ["hr.f.hoursPerDay", b.hoursPerDay != null ? `${b.hoursPerDay} h × ${b.daysPerWeek ?? "-"} d` : ""],
              ["hr.f.ratePerHour", b.ratePerHour != null ? money(b.ratePerHour) : ""],
            ])}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("hr.emp.step.documents")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("hr.f.documentType")}</TableHead>
                <TableHead>{t("hr.f.file")}</TableHead>
                <TableHead>{t("hr.f.expiryDate")}</TableHead>
                <TableHead>{t("hr.verified")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!emp.documents?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    {t("hr.noDocuments")}
                  </TableCell>
                </TableRow>
              )}
              {(emp.documents ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.documentType?.name}</TableCell>
                  <TableCell>
                    {d.downloadUrl ? (
                      <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        {d.fileName}
                      </a>
                    ) : (
                      d.fileName
                    )}
                  </TableCell>
                  <TableCell className={d.expired ? "text-destructive" : ""}>{formatDate(d.expiryDate ?? undefined, language)}</TableCell>
                  <TableCell>{d.verified ? <Badge>{t("hr.verified")}</Badge> : <Badge variant="outline">{t("hr.unverified")}</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {canUpdate && (
                      <>
                        <Button variant="ghost" size="icon" aria-label={d.verified ? t("hr.unverify") : t("hr.verify")} onClick={async () => (await attempt(() => EmployeeService.verifyDocument(id, d.id ?? "", !d.verified), t("common.saved"))) && reload()}>
                          <BadgeCheck className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("hr.removeDocumentOf", { name: d.documentType?.name ?? "" })} onClick={async () => (await attempt(() => EmployeeService.removeDocument(id, d.id ?? ""), t("common.saved"))) && reload()}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {canUpdate && (
            <div className="flex flex-wrap items-end gap-2">
              <PlainSelect label={t("hr.f.documentType")} className="w-48" value={doc.documentTypeId} onChange={(v) => setDoc({ ...doc, documentTypeId: v })} options={docTypes} />
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Upload className="size-4" /> {doc.fileName || t("hr.chooseFile")}
                <input
                  type="file"
                  className="sr-only"
                  aria-label={t("hr.f.file")}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const [f] = await MediaService.upload([file])
                      setDoc((d) => ({ ...d, fileId: f?.id ?? "", fileName: f?.originalName ?? file.name }))
                    } catch (err) {
                      toast.error(errorMessage(err))
                    }
                  }}
                />
              </label>
              <Input type="date" className="w-40" aria-label={t("hr.f.expiryDate")} value={doc.expiryDate} onChange={(e) => setDoc({ ...doc, expiryDate: e.target.value })} />
              <Button
                disabled={!doc.documentTypeId || !doc.fileId}
                onClick={async () => {
                  if (await attempt(() => EmployeeService.addDocument(id, { documentTypeId: Number(doc.documentTypeId), fileId: Number(doc.fileId), expiryDate: doc.expiryDate || undefined }), t("common.saved"))) {
                    setDoc({ documentTypeId: "", fileId: "", fileName: "", expiryDate: "" })
                    reload()
                  }
                }}
              >
                {t("hr.addDocument")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{editing && <EmployeeWizard employee={emp} onClose={() => setEditing(false)} onSaved={reload} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("hr.confirmDelete", { name: emp.fullName ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (await attempt(() => EmployeeService.remove(id), t("common.saved"))) router.push("/hrm/employees")
        }}
      />
    </div>
  )
}
