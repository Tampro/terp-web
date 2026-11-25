"use client"

import * as React from "react"
import { Ban, Check, Plus, Trash2, UserX } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useUrlQuery } from "@/hooks/use-url-query"
import { HrOptions, type Row } from "@/lib/hrm/hrm.service"
import { RECOMMENDATIONS, REC, RecOptions, RecruitmentService, type InterviewDetail } from "@/lib/recruitment/recruitment.service"
import { ApiError } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { BoardCard, StatusBoard } from "../_components/status-board"
import { attempt, CrudSection, FormDialogBody, HrStatus, initialValues, pick, TabbedPage, toSelect, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../../hrm/_components/crud-kit"

const REC_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = { STRONG_HIRE: "default", HIRE: "default", MAYBE: "secondary", REJECT: "destructive", STRONG_REJECT: "destructive" }

export default function InterviewsPage() {
  return (
    <React.Suspense>
      <Interviews />
    </React.Suspense>
  )
}

/** §17 interviews: schedule (candidate, round, type, date, time, duration, location / link, interviewers); Scheduled → Completed (candidate moves to Offer) / Cancelled / No-show; feedback per interviewer and scorecard. */
function Interviews() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const perms = useAuthStore((s) => s.me?.permissions)
  const manage = !!perms?.includes("RECRUITMENT_MANAGE")
  const canView = !!perms?.includes("RECRUITMENT_VIEW")
  // a panel member without RECRUITMENT_VIEW only sees "My interviews": the form lookups would all be 403
  const candidateOpts = useOptions("rec:candidates", RecOptions.candidates, canView)
  const candidates = toSelect(candidateOpts)
  const roundOpts = useOptions("rec:rounds", RecOptions.rounds, canView)
  /** rounds of the chosen candidate's job (REC_024) */
  const roundsFor = (v: Record<string, unknown>) => {
    const job = candidateOpts.find((c) => c.id === String(v.candidateId ?? ""))?.jobId
    return toSelect(roundOpts.filter((r) => !job || r.jobId === job))
  }
  const types = toSelect(useOptions("rc:interview-types", () => RecOptions.catalog("interview-types"), canView))
  const employees = toSelect(useOptions("employees", HrOptions.employees, canView))
  const [viewing, setViewing] = React.useState<string>()
  const [reload, setReload] = React.useState(0)
  const { searchParams, update } = useUrlQuery()
  const myFrom = searchParams.get("from") ?? ""
  const [noProfile, setNoProfile] = React.useState(false)
  const is = (...s: string[]) => (r: Row) => s.includes(String(r.status))
  const status = (s: string) => (r: Row) => REC.interviews.put(r.id ?? "", "status", { status: s })

  const cfg: CrudConfig = {
    id: "interviews",
    load: REC.interviews.list,
    countsPath: "/v1/recruitment/interviews/summary",
    keyword: true,
    statuses: ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"],
    reloadKey: reload,
    onRowClick: (r) => setViewing(r.id),
    columns: [
      { label: "rc.candidate", path: "candidate.fullName" },
      { label: "rc.round", path: "round.name" },
      { label: "le.type", path: "interviewType.name" },
      { label: "tr.schedule", render: (r) => `${formatDate(String(r.date ?? ""), language)} ${String(r.startTime ?? "").slice(0, 5)} · ${String(r.durationMinutes ?? "")}′` },
      { label: "tr.location", render: (r) => String(r.location || r.meetingLink || "-") },
      { label: "rc.interviewers", render: (r) => ((r.interviewers as { name?: string }[] | undefined) ?? []).map((i) => i.name).join(", ") || "-" },
      { label: "rc.feedback", render: (r) => (r.feedbackSubmitted ? t("hr.yes") : "-") },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => `${String(pick(r, "candidate.fullName") ?? "")} · ${String(pick(r, "round.name") ?? "")}`,
    createLabel: "rc.interview.create",
    fields: [
      { name: "candidateId", label: "rc.candidate", type: "select", required: true, numeric: true, options: candidates, full: true },
      { name: "roundId", label: "rc.round", type: "select", required: true, numeric: true, optionsFor: roundsFor, hidden: (v) => !v.candidateId },
      { name: "interviewTypeId", label: "le.type", type: "select", required: true, numeric: true, options: types },
      { name: "date", label: "hr.f.date", type: "date", required: true },
      { name: "startTime", label: "hr.f.startTime", type: "time", required: true },
      { name: "durationMinutes", label: "rc.duration", type: "number", required: true, min: 5, max: 720 },
      { name: "location", label: "tr.location", max: 255 },
      { name: "meetingLink", label: "tr.meetingLink", max: 1000, pattern: /^https?:\/\/\S+$/, patternMsg: "tr.v.url" },
      { name: "interviewerIds", label: "rc.interviewers", type: "multi", required: true, options: employees },
    ],
    defaults: { durationMinutes: "60" },
    toValues: (r) => ({
      ...r,
      candidateId: pick(r, "candidate.id"),
      roundId: pick(r, "round.id"),
      interviewTypeId: pick(r, "interviewType.id"),
      startTime: String(r.startTime ?? "").slice(0, 5),
      interviewerIds: ((r.interviewers as { employeeId?: string }[] | undefined) ?? []).map((i) => i.employeeId),
    }),
    save: REC.interviews.save,
    remove: REC.interviews.remove,
    canEdit: is("SCHEDULED"),
    canDelete: is("SCHEDULED", "CANCELLED"),
    actions: [
      { key: "complete", label: "rc.interview.complete", icon: <Check className="size-4" />, when: is("SCHEDULED"), confirmDesc: "rc.interview.completeDesc", run: status("COMPLETED") },
      { key: "no-show", label: "rc.interview.noShow", icon: <UserX className="size-4" />, when: is("SCHEDULED"), run: status("NO_SHOW") },
      { key: "cancel", label: "rc.interview.cancel", icon: <Ban className="size-4" />, when: is("SCHEDULED"), destructive: true, run: status("CANCELLED") },
    ],
    manage,
  }
  // GET /interviews/my: any signed-in employee on the panel (no RECRUITMENT_VIEW); `from` = the URL's ?from (default today)
  const mine: CrudConfig = {
    id: "my-interviews",
    // a user without an employee profile (EMP_001) is on no panel: an empty list and a note instead of an error
    load: (q) =>
      RecruitmentService.myInterviews({ from: (q.from as string | undefined) || undefined, page: q.page as number, size: q.size as number }).then(
        (p) => {
          setNoProfile(false)
          return p
        },
        (e: unknown) => {
          if (e instanceof ApiError && e.code === "EMP_001") {
            setNoProfile(true)
            return { content: [] }
          }
          throw e
        },
      ),
    query: { from: myFrom || undefined },
    toolbar: (
      <div className="flex flex-wrap items-center gap-2">
        {noProfile && <span className="text-muted-foreground text-sm">{t("rc.my.noProfile")}</span>}
        <label htmlFor="my-from" className="text-sm">
          {t("rc.my.from")}
        </label>
        <Input id="my-from" type="date" className="w-44" value={myFrom} onChange={(e) => update({ from: e.target.value || undefined, page: undefined })} />
      </div>
    ),
    onRowClick: canView ? (r) => setViewing(r.id) : undefined,
    columns: cfg.columns.filter((c) => c.label !== "rc.interviewers"),
    rowName: cfg.rowName,
    emptyLabel: "rc.my.empty",
    manage: false,
  }
  return (
    <>
      <TabbedPage title={t("menu.rc.interviews")} description={t("rc.interviews.subtitle")} tabs={[
          { key: "list", label: "menu.rc.interviews", visible: canView, content: () => <CrudSection config={cfg} /> },
          { key: "my", label: "rc.my.tab", content: () => <CrudSection config={mine} /> },
          {
            key: "board",
            visible: canView,
            label: "rc.board",
            content: () => (
              <StatusBoard
                path="/v1/recruitment/interviews/kanban"
                manage={manage}
                reloadKey={reload}
                move={(r, s) => REC.interviews.put(r.id ?? "", "status", { status: s })}
                renderCard={(r) => (
                  <BoardCard
                    title={String(pick(r, "candidate.fullName") ?? "-")}
                    label={t("rc.board.open", { name: String(pick(r, "candidate.fullName") ?? "") })}
                    lines={[String(pick(r, "round.name") ?? "-"), `${formatDate(String(r.date ?? "") || undefined, language)} ${String(r.startTime ?? "").slice(0, 5)}`]}
                    onOpen={() => setViewing(r.id)}
                  />
                )}
              />
            ),
          },
        ]}
      />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{viewing && <InterviewView key={viewing} id={viewing} manage={manage} onChanged={() => setReload((x) => x + 1)} />}</DialogContent>
      </Dialog>
    </>
  )
}

/** Feedback of each interviewer (scores 1–5, Strong Hire … Strong Reject) and the averaged scorecard; only for a completed interview (REC_028). */
function InterviewView({ id, manage, onChanged }: { id: string; manage: boolean; onChanged: () => void }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [d, setD] = React.useState<InterviewDetail>()
  const [key, setKey] = React.useState(0)
  const [adding, setAdding] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    RecruitmentService.interview(id)
      .then((x) => !cancelled && setD(x))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id, key])
  if (!d) return <Skeleton className="h-64 w-full" />
  const given = new Set((d.feedback ?? []).map((f) => f.employeeId))
  const pending = (d.interviewers ?? []).filter((i) => !given.has(i.employeeId))
  const score = (n?: number | null) => (n == null ? "-" : n.toFixed(1))
  const scoreField = (name: string, label: TranslationKey, required = false): FieldDef => ({
    name,
    label,
    type: "select",
    required,
    numeric: true,
    none: !required,
    options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) })),
  })
  const feedbackFields: FieldDef[] = [
    { name: "employeeId", label: "rc.interviewer", type: "select", required: true, numeric: true, options: pending.map((i) => ({ value: String(i.employeeId), label: String(i.name ?? i.employeeId) })) },
    { name: "recommendation", label: "rc.recommendation", type: "select", required: true, options: RECOMMENDATIONS.map((r) => ({ value: r, label: t(`rc.rec.${r}`) })) },
    scoreField("overallScore", "rc.score.overall", true),
    // every score is required: an omitted one arrives as 0 and fails @Min(1) (COMMON_001), although Swagger marks it optional
    scoreField("technicalScore", "rc.score.technical", true),
    scoreField("communicationScore", "rc.score.communication", true),
    scoreField("culturalFitScore", "rc.score.culturalFit", true),
    { name: "strengths", label: "pf.pros", type: "textarea", max: 5000 },
    { name: "weaknesses", label: "pf.cons", type: "textarea", max: 5000 },
    { name: "comments", label: "hr.f.comment", type: "textarea", max: 5000 },
  ]
  const s = d.feedbackSummary
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {d.candidate?.fullName} · {d.round?.name}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          {d.job?.title} · {d.interviewType?.name} · {formatDate(d.date, language)} {String(d.startTime ?? "").slice(0, 5)} <HrStatus status={d.status} />
        </DialogDescription>
      </DialogHeader>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rc.scorecard")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-4" data-testid="scorecard">
          <span>
            {t("rc.score.overall")}: <b>{score(s?.overall)}</b>
          </span>
          <span>
            {t("rc.score.technical")}: <b>{score(s?.technical)}</b>
          </span>
          <span>
            {t("rc.score.communication")}: <b>{score(s?.communication)}</b>
          </span>
          <span>
            {t("rc.score.culturalFit")}: <b>{score(s?.culturalFit)}</b>
          </span>
          <div className="flex flex-wrap gap-1 sm:col-span-4">
            {Object.entries(s?.recommendations ?? {})
              .filter(([, n]) => n > 0)
              .map(([k, n]) => (
                <Badge key={k} variant={REC_VARIANT[k] ?? "outline"}>
                  {t(`rc.rec.${k}` as TranslationKey)} × {n}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {(d.feedback ?? []).map((f) => (
          <Card key={f.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                {f.interviewerName} <Badge variant={REC_VARIANT[f.recommendation ?? ""] ?? "outline"}>{t(`rc.rec.${f.recommendation ?? "MAYBE"}` as TranslationKey)}</Badge>
              </CardTitle>
              {manage && (
                <Button variant="ghost" size="icon" aria-label={t("hr.deleteOf", { name: f.interviewerName ?? "" })} onClick={async () => (await attempt(() => RecruitmentService.removeFeedback(id, f.id ?? ""), t("common.saved"))) && setKey((x) => x + 1)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                {t("rc.score.overall")} {f.overallScore ?? "-"} · {t("rc.score.technical")} {f.technicalScore ?? "-"} · {t("rc.score.communication")} {f.communicationScore ?? "-"} · {t("rc.score.culturalFit")} {f.culturalFitScore ?? "-"}
              </span>
              {f.strengths && (
                <span>
                  {t("pf.pros")}: {f.strengths}
                </span>
              )}
              {f.weaknesses && (
                <span>
                  {t("pf.cons")}: {f.weaknesses}
                </span>
              )}
              {f.comments && <span>{f.comments}</span>}
            </CardContent>
          </Card>
        ))}
      </div>
      {manage &&
        (d.status === "COMPLETED" ? (
          pending.length > 0 && (
            <Button variant="outline" className="w-fit" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> {t("rc.addFeedback")}
            </Button>
          )
        ) : (
          <p className="text-muted-foreground text-sm">{t("rc.feedbackAfter")}</p>
        ))}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          {adding && (
            <FormDialogBody
              prefix="feedback"
              title={t("rc.addFeedback")}
              fields={feedbackFields}
              initial={initialValues(feedbackFields, null, pending.length === 1 ? { employeeId: pending[0].employeeId } : undefined)}
              onClose={() => setAdding(false)}
              onSubmit={async (body) => {
                const ok = await attempt(() => RecruitmentService.addFeedback(id, body), t("common.saved"))
                if (ok) {
                  setKey((x) => x + 1)
                  onChanged()
                }
                return ok
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
