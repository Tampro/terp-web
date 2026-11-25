"use client"

import * as React from "react"
import { Check, Download, Handshake, Mail, Send, ThumbsDown, ThumbsUp, UserPlus, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { EMPLOYMENT_TYPES, HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { REC, RecOptions, RecruitmentService } from "@/lib/recruitment/recruitment.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { formatDate } from "@/lib/format"
import { saveBlob } from "@/lib/pos/pos.service"

import { BoardCard, StatusBoard } from "../_components/status-board"
import { CrudSection, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, orgChain } from "../../hrm/_components/crud-kit"

const OFFER_STATUSES = ["DRAFT", "SENT", "NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED"] as const
/** no status move or approval change any more (REC_067) */
const FINAL = ["ACCEPTED", "DECLINED", "EXPIRED"]
const APPROVAL_VARIANT: Record<string, "default" | "outline" | "destructive"> = { APPROVED: "default", PENDING: "outline", REJECTED: "destructive" }

export default function OffersPage() {
  return (
    <React.Suspense>
      <Offers />
    </React.Suspense>
  )
}

/** §17 offers: Draft → Sent → Negotiating / Accepted / Declined / Expired, approval Approved / Rejected (needed before sending, REC_058), letter from a template, Convert to Employee once accepted. */
function Offers() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("RECRUITMENT_MANAGE")
  const candidates = toSelect(useOptions("rec:candidates", RecOptions.candidates))
  const postings = toSelect(useOptions("rec:postings", RecOptions.postings))
  const departmentOpts = useOptions("departments", () => HrOptions.departments())
  const departments = toSelect(departmentOpts)
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const templates = toSelect(useOptions("rec:templates", RecOptions.templates))
  const branches = toSelect(useOptions("branches", HrOptions.branches))
  const designationOpts = useOptions("designations", () => HrOptions.designations())
  const chain = orgChain(departmentOpts, designationOpts)
  const is = (...s: string[]) => (r: Row) => s.includes(String(r.status))
  const approved = (r: Row) => r.approvalStatus === "APPROVED"
  const setStatus = (status: string) => (r: Row) => REC.offers.put(r.id ?? "", "status", { status })
  const approval = (approvalStatus: string) => (r: Row) => REC.offers.put(r.id ?? "", "approval", { approvalStatus })

  const cfg: CrudConfig = {
    id: "offers",
    load: REC.offers.list,
    countsPath: "/v1/recruitment/offers/status-counts",
    keyword: true,
    statuses: [...OFFER_STATUSES],
    columns: [
      { label: "rc.candidate", path: "candidate.fullName" },
      { label: "rc.position", render: (r) => String(pick(r, "job.title") ?? "-") },
      { label: "hr.f.department", path: "department.name" },
      { label: "rc.salary", path: "salary", kind: "money" },
      { label: "hr.f.startDate", path: "startDate", kind: "date" },
      { label: "rc.expires", render: (r) => <span className={r.expired ? "text-destructive" : ""}>{String(r.expirationDate ?? "-")}</span> },
      { label: "rc.approval", render: (r) => <Badge variant={APPROVAL_VARIANT[String(r.approvalStatus)] ?? "outline"}>{t(`hr.status.${String(r.approvalStatus ?? "PENDING")}` as TranslationKey)}</Badge> },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(pick(r, "candidate.fullName") ?? ""),
    createLabel: "rc.offer.create",
    fields: [
      { name: "candidateId", label: "rc.candidate", type: "select", required: true, numeric: true, options: candidates, full: true },
      { name: "jobPostingId", label: "rc.position", type: "select", numeric: true, none: true, options: postings },
      { name: "departmentId", label: "hr.f.department", type: "select", numeric: true, none: true, options: departments },
      { name: "salary", label: "rc.salary", type: "number", required: true, min: 0 },
      { name: "approvedByEmployeeId", label: "rc.approver", type: "select", numeric: true, none: true, options: employees },
      { name: "startDate", label: "hr.f.startDate", type: "date" },
      { name: "expirationDate", label: "rc.expires", type: "date", check: (v) => (v.startDate && v.expirationDate && String(v.expirationDate) > String(v.startDate) ? "rc.v.expiry" : undefined) },
      { name: "benefits", label: "rc.benefits", type: "textarea", max: 5000 },
    ],
    toValues: (r) => ({ ...r, candidateId: pick(r, "candidate.id"), jobPostingId: pick(r, "job.id"), departmentId: pick(r, "department.id"), approvedByEmployeeId: pick(r, "approvedBy.id") }),
    save: REC.offers.save,
    remove: REC.offers.remove,
    canEdit: is("DRAFT", "NEGOTIATING"),
    canDelete: is("DRAFT"),
    actions: [
      { key: "approve", label: "hr.approve", icon: <Check className="size-4" />, when: (r) => !approved(r) && is("DRAFT", "NEGOTIATING")(r), run: approval("APPROVED") },
      { key: "reject-approval", label: "hr.reject", icon: <X className="size-4" />, when: (r) => r.approvalStatus === "PENDING" && is("DRAFT", "NEGOTIATING")(r), destructive: true, run: approval("REJECTED") },
      { key: "send", label: "rc.offer.send", icon: <Send className="size-4" />, when: (r) => approved(r) && is("DRAFT")(r), run: setStatus("SENT") },
      { key: "negotiating", label: "rc.offer.negotiating", icon: <Handshake className="size-4" />, when: is("SENT"), run: setStatus("NEGOTIATING") },
      { key: "accepted", label: "rc.offer.accepted", icon: <ThumbsUp className="size-4" />, when: is("SENT", "NEGOTIATING"), run: setStatus("ACCEPTED") },
      { key: "declined", label: "rc.offer.declined", icon: <ThumbsDown className="size-4" />, when: is("SENT", "NEGOTIATING"), destructive: true, run: setStatus("DECLINED") },
      {
        key: "letter",
        label: "rc.offer.letter",
        icon: <Download className="size-4" />,
        when: () => templates.length > 0,
        fields: [{ name: "templateId", label: "rc.template", type: "select", required: true, options: templates }],
        run: async (r, b) => saveBlob(await RecruitmentService.offerLetter(r.id ?? "", String(b.templateId)), `offer-${String(pick(r, "candidate.fullName") ?? r.id)}.pdf`),
      },
      {
        key: "email-letter",
        label: "rc.offer.emailLetter",
        icon: <Mail className="size-4" />,
        when: (r) => templates.length > 0 && is("SENT", "NEGOTIATING", "ACCEPTED")(r),
        fields: [{ name: "templateId", label: "rc.template", type: "select", required: true, options: templates }],
        confirmDesc: "rc.offer.emailLetterDesc",
        run: (r, b) => RecruitmentService.emailOfferLetter(r.id ?? "", String(b.templateId)),
      },
      {
        key: "convert",
        label: "rc.offer.convert",
        icon: <UserPlus className="size-4" />,
        when: (r) => is("ACCEPTED")(r),
        confirmDesc: "rc.offer.convertDesc",
        fields: [
          { name: "employmentType", label: "hr.f.employmentType", type: "select", required: true, options: EMPLOYMENT_TYPES.map((x) => ({ value: x, label: t(`hr.type.${x}`) })) },
          { name: "employeeStatus", label: "hr.f.status", type: "select", options: (["PROBATION", "ACTIVE"] as const).map((x) => ({ value: x, label: t(`hr.status.${x}`) })) },
          { name: "dateOfJoining", label: "hr.f.dateOfJoining", type: "date" },
          { name: "branchId", label: "hr.f.branch", type: "select", numeric: true, none: true, options: branches, resets: ["departmentId"] },
          { name: "departmentId", label: "hr.f.department", type: "select", numeric: true, none: true, optionsFor: chain.departmentsOf("branchId"), resets: ["designationId"] },
          { name: "designationId", label: "hr.f.designation", type: "select", numeric: true, none: true, optionsFor: chain.designationsOf("departmentId") },
          { name: "employeeCode", label: "hr.f.employeeCode", max: 50, pattern: /^[A-Za-z0-9._-]*$/, patternMsg: "hr.v.code" },
          { name: "password", label: "hr.f.password", type: "password", max: 128, check: (v) => (v.password && String(v.password).length < 8 ? "hr.v.password" : undefined) },
        ],
        run: (r, b) => RecruitmentService.convert(r.id ?? "", b),
      },
    ],
    manage,
  }
  /** moves the backend refuses (OfferService.changeStatus): out of a final status (REC_067), SENT before approval (REC_058) */
  const check = (r: Row, to: string): TranslationKey | undefined => {
    if (FINAL.includes(String(r.status))) return "rc.board.final"
    if (to === "SENT" && !approved(r)) return "rc.board.notApproved"
    return undefined
  }
  return (
    <TabbedPage
      title={t("menu.rc.offers")}
      description={t("rc.offers.subtitle")}
      tabs={[
        { key: "list", label: "menu.rc.offers", content: () => <CrudSection config={cfg} /> },
        {
          key: "board",
          label: "rc.board",
          content: () => (
            <StatusBoard
              path="/v1/recruitment/offers/kanban"
              manage={manage}
              check={check}
              move={(r, s) => setStatus(s)(r)}
              renderCard={(r) => (
                <BoardCard
                  title={String(pick(r, "candidate.fullName") ?? "-")}
                  label={String(pick(r, "candidate.fullName") ?? "")}
                  lines={[
                    String(pick(r, "job.title") ?? "-"),
                    `${t("rc.approval")}: ${t(`hr.status.${String(r.approvalStatus ?? "PENDING")}` as TranslationKey)}`,
                    r.expirationDate ? `${t("rc.expires")}: ${formatDate(String(r.expirationDate), language)}` : "",
                  ].filter(Boolean)}
                />
              )}
            />
          ),
        },
      ]}
    />
  )
}
