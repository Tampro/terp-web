"use client"

import * as React from "react"
import { toast } from "sonner"


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useMoney } from "@/hooks/use-money"
import { HrOptions } from "@/lib/hrm/hrm.service"
import { CANDIDATE_STATUSES, REC, RecOptions, RecruitmentService, type CandidateDetail } from "@/lib/recruitment/recruitment.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { BoardCard, StatusBoard } from "../_components/status-board"
import { attempt, CrudSection, errorMessage, HrStatus, PlainSelect, pick, TabbedPage, toSelect, today, useAuthStore, useOptions, type CrudConfig } from "../../hrm/_components/crud-kit"

export default function CandidatesPage() {
  return (
    <React.Suspense>
      <Candidates />
    </React.Suspense>
  )
}

/** §17 candidates (New → Screening → Interview → Offer → Hired / Rejected) and assessments (only for candidates recommended Hire / Strong Hire). */
function Candidates() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const money = useMoney()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("RECRUITMENT_MANAGE")
  const postings = toSelect(useOptions("rec:postings", RecOptions.postings))
  const sources = toSelect(useOptions("rc:candidate-sources", () => RecOptions.catalog("candidate-sources")))
  const candidates = toSelect(useOptions("rec:candidates", RecOptions.candidates))
  const employees = toSelect(useOptions("employees", HrOptions.employees))
  const [viewing, setViewing] = React.useState<string>()
  const [reload, setReload] = React.useState(0)

  const list: CrudConfig = {
    id: "candidates",
    load: REC.candidates.list,
    countsPath: "/v1/recruitment/candidates/status-counts",
    keyword: true,
    statuses: [...CANDIDATE_STATUSES],
    reloadKey: reload,
    onRowClick: (r) => setViewing(r.id),
    columns: [
      { label: "hr.f.fullName", path: "fullName" },
      { label: "hr.f.email", path: "email" },
      { label: "rc.job", path: "job.title" },
      { label: "rc.source", path: "source.name" },
      { label: "rc.experience", path: "experienceYears" },
      { label: "rc.expectedSalary", path: "expectedSalary", kind: "money" },
      { label: "rc.appliedOn", path: "applicationDate", kind: "date" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.fullName ?? ""),
    createLabel: "rc.candidate.create",
    fields: [
      { name: "jobPostingId", label: "rc.job", type: "select", required: true, numeric: true, options: postings, full: true },
      { name: "firstName", label: "rc.firstName", required: true, max: 100 },
      { name: "lastName", label: "rc.lastName", required: true, max: 100 },
      { name: "email", label: "hr.f.email", type: "email", required: true, max: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
      { name: "phone", label: "hr.f.phone", max: 30 },
      { name: "sourceId", label: "rc.source", type: "select", numeric: true, none: true, options: sources },
      { name: "applicationDate", label: "rc.appliedOn", type: "date" },
      { name: "currentCompany", label: "rc.currentCompany", max: 150 },
      { name: "currentPosition", label: "rc.currentPosition", max: 150 },
      { name: "experienceYears", label: "rc.experienceYears", type: "number", min: 0, max: 60 },
      { name: "noticePeriod", label: "hr.f.noticePeriod", max: 50 },
      { name: "currentSalary", label: "rc.currentSalary", type: "number", min: 0 },
      { name: "expectedSalary", label: "rc.expectedSalary", type: "number", min: 0 },
      { name: "city", label: "hr.f.city", max: 100 },
      { name: "country", label: "hr.f.country", max: 100 },
      { name: "coverLetterMessage", label: "rc.coverLetter", type: "textarea", max: 5000 },
    ],
    defaults: { applicationDate: today() },
    remove: REC.candidates.remove,
    save: REC.candidates.save,
    canEdit: () => false,
    manage,
  }
  const assessments: CrudConfig = {
    id: "assessments",
    load: REC.assessments.list,
    countsPath: "/v1/recruitment/assessments/status-counts",
    keyword: true,
    statuses: ["PENDING", "PASS", "FAIL"],
    columns: [
      { label: "rc.candidate", path: "candidate.name" },
      { label: "hr.f.name", path: "name" },
      { label: "tr.score", render: (r) => `${String(r.score ?? "-")}/${String(r.maxScore ?? "-")}${r.percentage != null ? ` (${Number(r.percentage).toFixed(0)}%)` : ""}` },
      { label: "rc.conductedBy", path: "conductedBy.name" },
      { label: "hr.f.date", path: "assessmentDate", kind: "date" },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => `${String(pick(r, "candidate.name") ?? "")} · ${String(r.name ?? "")}`,
    createLabel: "rc.assessment.create",
    fields: [
      { name: "candidateId", label: "rc.candidate", type: "select", required: true, numeric: true, options: candidates, full: true },
      { name: "name", label: "hr.f.name", required: true, max: 200 },
      { name: "assessmentDate", label: "hr.f.date", type: "date", required: true },
      { name: "score", label: "tr.score", type: "number", required: true, min: 0 },
      { name: "maxScore", label: "rc.maxScore", type: "number", required: true, min: 0, check: (v) => (Number(v.score) > Number(v.maxScore) ? "rc.v.score" : undefined) },
      { name: "status", label: "hr.f.status", type: "select", options: (["PENDING", "PASS", "FAIL"] as const).map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
      { name: "conductedByEmployeeId", label: "rc.conductedBy", type: "select", numeric: true, none: true, options: employees },
      { name: "comments", label: "hr.f.comment", type: "textarea", max: 5000 },
    ],
    defaults: { status: "PENDING", assessmentDate: today(), maxScore: "100" },
    toValues: (r) => ({ ...r, candidateId: pick(r, "candidate.id"), conductedByEmployeeId: pick(r, "conductedBy.id") }),
    save: REC.assessments.save,
    remove: REC.assessments.remove,
    manage,
  }
  return (
    <>
      <TabbedPage
        title={t("menu.rc.candidates")}
        description={t("rc.candidates.subtitle")}
        tabs={[
          { key: "candidates", label: "menu.rc.candidates", content: () => <CrudSection config={list} /> },
          { key: "board", label: "rc.board", content: () => (
            <StatusBoard
              path="/v1/recruitment/candidates/kanban"
              manage={manage}
              reloadKey={reload}
              move={(r, status) => REC.candidates.put(r.id ?? "", "status", { status })}
              renderCard={(r) => <BoardCard title={String(r.fullName ?? "-")} label={t("rc.board.open", { name: String(r.fullName ?? "") })} lines={[String(pick(r, "job.title") ?? "-"), formatDate(String(r.applicationDate ?? "") || undefined, language)]} onOpen={() => setViewing(r.id)} />}
            />
          ),
        },
          { key: "assessments", label: "rc.assessments", content: () => <CrudSection config={assessments} /> },
        ]}
      />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{viewing && <CandidateView key={viewing} id={viewing} manage={manage} money={money} onChanged={() => setReload((x) => x + 1)} />}</DialogContent>
      </Dialog>
    </>
  )
}

/** Candidate detail: profile, answers to the job's questions, resume / cover letter, status. */
function CandidateView({ id, manage, money, onChanged }: { id: string; manage: boolean; money: (n?: number | null) => string; onChanged: () => void }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [c, setC] = React.useState<CandidateDetail>()
  const [key, setKey] = React.useState(0)
  const [uploading, setUploading] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    RecruitmentService.candidate(id)
      .then((x) => !cancelled && setC(x))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id, key])
  if (!c) return <Skeleton className="h-64 w-full" />
  const rows: [TranslationKey, React.ReactNode][] = [
    ["hr.f.email", c.email],
    ["hr.f.phone", c.phone],
    ["rc.job", c.job?.title],
    ["rc.source", c.source?.name],
    ["rc.currentPosition", [c.currentPosition, c.currentCompany].filter(Boolean).join(" · ")],
    ["rc.experienceYears", c.experienceYears],
    ["rc.expectedSalary", c.expectedSalary != null ? money(c.expectedSalary) : ""],
    ["hr.f.noticePeriod", c.noticePeriod],
    ["hr.f.address", [c.address, c.city, c.country].filter(Boolean).join(", ")],
    ["rc.appliedOn", formatDate(c.applicationDate, language)],
  ]
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {c.firstName} {c.lastName}
        </DialogTitle>
        <DialogDescription className="flex items-center gap-2">
          <HrStatus status={c.status} /> {c.employeeId && <span>{t("rc.converted")}</span>}
        </DialogDescription>
      </DialogHeader>
      {manage && (
        <div className="flex flex-wrap items-center gap-2">
          <PlainSelect
            label={t("rc.changeStatus")}
            className="w-48"
            value={c.status ?? ""}
            onChange={async (v) => {
              if (await attempt(() => RecruitmentService.candidateStatus(id, v), t("common.saved"))) {
                setKey((x) => x + 1)
                onChanged()
              }
            }}
            options={CANDIDATE_STATUSES.map((s) => ({ value: s, label: t(`hr.status.${s}`) }))}
          />
          <label className="cursor-pointer rounded-md border px-3 py-2 text-sm">
            {uploading ? t("hr.uploading") : t("rc.uploadResume")}
            <input
              type="file"
              className="sr-only"
              aria-label={t("rc.uploadResume")}
              accept=".pdf,.doc,.docx"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploading(true)
                try {
                  await RecruitmentService.uploadResume(id, file)
                  toast.success(t("common.saved"))
                  setKey((x) => x + 1)
                } catch (err) {
                  toast.error(errorMessage(err))
                } finally {
                  setUploading(false)
                }
              }}
            />
          </label>
        </div>
      )}
      <dl className="grid grid-cols-[minmax(0,11rem)_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-muted-foreground">{t(k)}</dt>
            <dd>{v || v === 0 ? v : "-"}</dd>
          </React.Fragment>
        ))}
        <dt className="text-muted-foreground">{t("rc.resume")}</dt>
        <dd>
          {c.resumeUrl ? (
            <a href={c.resumeUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {c.resumeName ?? t("hr.open")}
            </a>
          ) : (
            "-"
          )}
          {c.coverLetterUrl && (
            <>
              {" · "}
              <a href={c.coverLetterUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {c.coverLetterName ?? t("rc.coverLetter")}
              </a>
            </>
          )}
        </dd>
      </dl>
      {c.coverLetterMessage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("rc.coverLetter")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{c.coverLetterMessage}</CardContent>
        </Card>
      )}
      {!!c.answers?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("rc.answers")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {c.answers.map((a) => (
              <div key={a.questionId}>
                <p className="text-muted-foreground">{a.question}</p>
                <p>{a.answer || "-"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}
