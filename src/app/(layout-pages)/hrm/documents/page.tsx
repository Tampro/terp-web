"use client"

import * as React from "react"
import { Check, Download, UserPlus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { DocumentService, HR, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { useT } from "@/lib/i18n"

import { attempt, CrudSection, errorMessage, FormDialogBody, initialValues, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../_components/crud-kit"

const hex = /^#[0-9A-Fa-f]{6}$/

export default function DocumentsPage() {
  return (
    <React.Suspense>
      <Documents />
    </React.Suspense>
  )
}

/** §15 documents (Pending → Approved / Rejected, download once approved), acknowledgments (Pending → Acknowledged), categories. */
function Documents() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("DOCUMENT_MANAGE")
  const categories = toSelect(useOptions("documentCategories", HrOptions.documentCategories))
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const documents = toSelect(useOptions("documents", HrOptions.documents))
  const [assigning, setAssigning] = React.useState(false)
  const [ackReload, setAckReload] = React.useState(0)
  const comment: FieldDef[] = [{ name: "comment", label: "hr.f.comment", type: "textarea", max: 1000 }]
  const pending = (r: Row) => r.status === "PENDING"
  const downloadable = (r: Row) => r.status === "APPROVED" || r.status === "PUBLISHED"
  const download = async (r: Row) => {
    try {
      const { url } = await DocumentService.download(r.id ?? "")
      if (url) window.open(url, "_blank", "noopener")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const docs: CrudConfig = {
    id: "documents",
    load: HR.documents.list,
    keyword: true,
    statuses: ["PENDING", "APPROVED", "REJECTED"],
    columns: [
      { label: "hr.f.title", path: "title" },
      { label: "hr.f.category", path: "category.name" },
      { label: "hr.f.effectiveDate", path: "effectiveDate", kind: "date" },
      { label: "hr.f.expiryDate", path: "expiryDate", kind: "date" },
      { label: "hr.f.requiresAck", path: "requiresAcknowledgment", kind: "bool" },
      { label: "hr.f.status", render: (r) => <DecisionCell row={r} /> },
      {
        label: "hr.f.file",
        render: (r) =>
          downloadable(r) ? (
            <Button variant="outline" size="sm" aria-label={t("hr.downloadOf", { name: String(r.title ?? "") })} onClick={() => download(r)}>
              <Download className="size-4" /> {t("hr.download")}
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs">{t("hr.doc.afterApproval")}</span>
          ),
      },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "hr.doc.create",
    fields: [
      { name: "title", label: "hr.f.title", required: true, max: 200, full: true },
      { name: "categoryId", label: "hr.f.category", type: "select", required: true, numeric: true, options: categories },
      { name: "fileId", label: "hr.f.file", type: "file", required: true },
      { name: "effectiveDate", label: "hr.f.effectiveDate", type: "date" },
      { name: "expiryDate", label: "hr.f.expiryDate", type: "date", check: (v) => (v.effectiveDate && v.expiryDate && String(v.expiryDate) < String(v.effectiveDate) ? "hr.v.expiryAfterEffective" : undefined) },
      { name: "requiresAcknowledgment", label: "hr.f.requiresAck", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 2000 },
    ],
    toValues: (r) => ({ ...r, categoryId: pick(r, "category.id"), fileId: pick(r, "file.id"), fileId__name: pick(r, "file.name") }),
    save: HR.documents.save,
    remove: HR.documents.remove,
    actions: [
      { key: "approve", label: "hr.approve", icon: <Check className="size-4" />, when: pending, fields: comment, run: (r, b) => HR.documents.post(r.id ?? "", "approve", b) },
      { key: "reject", label: "hr.reject", icon: <X className="size-4" />, when: pending, fields: comment, destructive: true, run: (r, b) => HR.documents.post(r.id ?? "", "reject", b) },
    ],
    invalidates: true,
    manage,
  }
  const acks: CrudConfig = {
    id: "acknowledgments",
    load: HR.acknowledgments.list,
    statusParam: "tab",
    statuses: ["PENDING", "ACKNOWLEDGED", "OVERDUE", "EXEMPTED"],
    keyword: true,
    reloadKey: ackReload,
    columns: [
      { label: "hr.f.document", path: "document.title" },
      { label: "hr.f.employee", render: (r) => String(pick(r, "employee.fullName") ?? pick(r, "employee.name") ?? "-") },
      { label: "hr.f.dueDate", path: "dueDate", kind: "date" },
      { label: "hr.f.assignedBy", path: "assignedByName" },
      { label: "hr.f.acknowledgedAt", path: "acknowledgedAt", kind: "date" },
      { label: "hr.f.status", path: "tab", kind: "status" },
    ],
    rowName: (r) => `${String(pick(r, "document.title") ?? "")} · ${String(pick(r, "employee.fullName") ?? pick(r, "employee.name") ?? "")}`,
    fields: [
      { name: "dueDate", label: "hr.f.dueDate", type: "date" },
      { name: "status", label: "hr.f.status", type: "select", options: (["PENDING", "ACKNOWLEDGED", "EXEMPTED"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
      { name: "note", label: "hr.f.notes", type: "textarea", max: 1000 },
    ],
    save: HR.acknowledgments.save,
    remove: HR.acknowledgments.remove,
    canEdit: (r) => r.status === "PENDING",
    actions: [
      {
        key: "acknowledge",
        label: "hr.ack.acknowledge",
        icon: <Check className="size-4" />,
        when: (r) => r.status === "PENDING",
        fields: [{ name: "note", label: "hr.f.notes", type: "textarea", max: 1000 }],
        run: (r, b) => HR.acknowledgments.post(r.id ?? "", "acknowledge", b),
      },
    ],
    manage,
    toolbar: manage ? (
      <Button onClick={() => setAssigning(true)}>
        <UserPlus className="size-4" /> {t("hr.ack.assign")}
      </Button>
    ) : undefined,
  }
  const cats: CrudConfig = {
    id: "document-categories",
    load: HR.documentCategories.list,
    keyword: true,
    statuses: ["ACTIVE", "INACTIVE"],
    columns: [
      { label: "hr.f.color", path: "color", kind: "color" },
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.mandatory", path: "mandatory", kind: "bool" },
      { label: "hr.documents", path: "documents" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hr.category.create",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 150 },
      { name: "color", label: "hr.f.color", type: "color", pattern: hex },
      { name: "icon", label: "hr.f.icon", max: 30, pattern: /^[a-z][a-z0-9-]{0,29}$/, patternMsg: "hr.v.icon" },
      { name: "status", label: "hr.f.status", type: "select", options: (["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
      { name: "mandatory", label: "hr.f.mandatory", type: "switch" },
      { name: "description", label: "hr.f.description", type: "textarea", max: 1000 },
    ],
    defaults: { status: "ACTIVE" },
    save: HR.documentCategories.save,
    remove: HR.documentCategories.remove,
    invalidates: true,
    manage,
  }
  const assignFields: FieldDef[] = [
    { name: "documentId", label: "hr.f.document", type: "select", required: true, numeric: true, options: documents },
    { name: "employeeId", label: "hr.f.employee", type: "select", required: true, numeric: true, options: employees },
    { name: "dueDate", label: "hr.f.dueDate", type: "date" },
    { name: "note", label: "hr.f.notes", type: "textarea", max: 1000 },
  ]
  return (
    <>
      <TabbedPage
        title={t("menu.hr.documents")}
        description={t("hr.doc.subtitle")}
        tabs={[
          { key: "documents", label: "hr.documents", content: () => <CrudSection config={docs} /> },
          { key: "acknowledgments", label: "hr.acknowledgments", content: () => <CrudSection config={acks} /> },
          { key: "categories", label: "hr.categories", content: () => <CrudSection config={cats} /> },
        ]}
      />
      <Dialog open={assigning} onOpenChange={setAssigning}>
        <DialogContent className="sm:max-w-lg">
          {assigning && (
            <FormDialogBody
              prefix="assign"
              title={t("hr.ack.assign")}
              description={t("hr.ack.assignHint")}
              fields={assignFields}
              initial={initialValues(assignFields, null)}
              submitLabel={t("hr.ack.assign")}
              onClose={() => setAssigning(false)}
              onSubmit={async (body) => {
                const ok = await attempt(() => HR.acknowledgments.save(undefined, body), t("common.saved"))
                if (ok) setAckReload((x) => x + 1)
                return ok
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function DecisionCell({ row }: { row: Row }) {
  const t = useT()
  return (
    <div className="grid gap-0.5">
      <span>{row.status ? t(`hr.status.${String(row.status)}` as "hr.status.PENDING") : "-"}</span>
      {!!row.decisionComment && <span className="text-muted-foreground text-xs">{String(row.decisionComment)}</span>}
    </div>
  )
}
