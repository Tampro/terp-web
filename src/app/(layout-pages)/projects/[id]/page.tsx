"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Kanban, List, Paperclip, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate, formatNumber } from "@/lib/format"
import { MediaService } from "@/lib/media/media.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import {
  BugService,
  ProjectService,
  StageService,
  TaskService,
  type ActivityDto,
  type AttachmentDto,
  type BugColumn,
  type BugDto,
  type EProjectStatus,
  type MilestoneDto,
  type ProjectDetailDto,
  type ProjectReport,
  type StageDto,
  type TaskColumn,
  type TaskDto,
} from "@/lib/project/project.service"

import { PickDialog } from "../../crm/_components/crm-kit"
import { KanbanBoard } from "../../crm/_components/kanban-board"
import { ProjectFormDialog } from "../_components/project-dialogs"
import { attempt, errorMessage, MilestoneStatusBadge, People, PriorityBadge, ProjectStatusBadge } from "../_components/project-kit"
import { useProjectLookups, userLabel } from "../_components/use-project-lookups"
import { BugDialog, MilestoneDialog, TaskDialog } from "../_components/work-dialogs"

const STATUSES: EProjectStatus[] = ["ONGOING", "ON_HOLD", "FINISHED"]
type Removing = { title: string; run: () => Promise<unknown> }

export default function ProjectDetailPage() {
  return (
    <React.Suspense>
      <ProjectDetail />
    </React.Suspense>
  )
}

/** §11.1 project detail: team, deadline, budget, days left, progress; tabs Overview, Tasks, Bugs, Milestones, Team, Attachments, Activity, Report. */
function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const permissions = useAuthStore((s) => s.me?.permissions)
  const manage = !!permissions?.includes("PROJECT_MANAGE")
  const taskManage = manage || !!permissions?.includes("PROJECT_TASK_MANAGE")
  const lookups = useProjectLookups()
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") ?? "overview"
  const taskMode = searchParams.get("mode") === "list" ? "list" : "board"

  const [detail, setDetail] = React.useState<ProjectDetailDto>()
  const [error, setError] = React.useState<string>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [taskBoard, setTaskBoard] = React.useState<TaskColumn[]>()
  const [bugBoard, setBugBoard] = React.useState<BugColumn[]>()
  const [milestones, setMilestones] = React.useState<MilestoneDto[]>([])
  const [attachments, setAttachments] = React.useState<AttachmentDto[]>()
  const [activity, setActivity] = React.useState<ActivityDto[]>()
  const [report, setReport] = React.useState<ProjectReport>()
  const [taskStages, setTaskStages] = React.useState<StageDto[]>([])
  const [bugStages, setBugStages] = React.useState<StageDto[]>([])
  const [editing, setEditing] = React.useState(false)
  const [task, setTask] = React.useState<{ task?: TaskDto } | null>(null)
  const [bug, setBug] = React.useState<{ bug?: BugDto } | null>(null)
  const [milestone, setMilestone] = React.useState<{ milestone?: MilestoneDto } | null>(null)
  const [pickingClients, setPickingClients] = React.useState(false)
  const [removing, setRemoving] = React.useState<Removing>()
  const fileInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false
    const quiet = <T,>(p: Promise<T>) => p.catch((e: Error) => (toast.error(e.message), undefined))
    ProjectService.get(id)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setError(undefined)
        Promise.all([
          quiet(TaskService.board(id)),
          quiet(BugService.board(id)),
          quiet(ProjectService.milestones(id)),
          quiet(ProjectService.attachments(id)),
          quiet(ProjectService.activity(id)),
          quiet(ProjectService.report(id)),
          quiet(StageService.list("TASK")),
          quiet(StageService.list("BUG")),
        ]).then(([tb, bb, ms, at, ac, rp, ts, bs]) => {
          if (cancelled) return
          setTaskBoard(tb ?? [])
          setBugBoard(bb ?? [])
          setMilestones(ms ?? [])
          setAttachments(at ?? [])
          setActivity(ac?.content ?? [])
          setReport(rp)
          setTaskStages(ts ?? [])
          setBugStages(bs ?? [])
        })
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  const run = async (fn: () => Promise<unknown>, done?: TranslationKey) => {
    const ok = await attempt(fn, done ? t(done) : undefined)
    if (ok) reload()
    return ok
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return
    try {
      const up = await MediaService.upload([...files])
      for (const f of up) if (f.id) await ProjectService.addAttachment(id, f.id)
      toast.success(t("crm.done.fileAdded"))
      reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  async function openFile(fileId?: string) {
    if (!fileId) return
    try {
      const f = await MediaService.file(fileId)
      if (f.viewUrl?.startsWith("http")) window.open(f.viewUrl, "_blank", "noopener")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (error)
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  if (!detail?.project)
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  const p = detail.project
  const team = p.userIds ?? []
  const name = (uid?: string | null) => userLabel(lookups.users, uid)
  const allTasks = (taskBoard ?? []).flatMap((c) => c.tasks ?? [])
  const milestoneName = (mid?: string | null) => milestones.find((m) => m.id === mid)?.title ?? "-"
  const clientName = (cid: string) => lookups.customers.find((c) => c.id === cid)?.companyName ?? `#${cid}`

  const stats = [
    { label: t("project.deadline"), value: formatDate(p.endDate, language), danger: p.overdue },
    { label: t("project.daysLeft"), value: detail.daysLeft == null ? "-" : formatNumber(detail.daysLeft, language), danger: (detail.daysLeft ?? 0) < 0 },
    { label: t("project.budget"), value: p.budget == null ? "-" : money(p.budget) },
    { label: t("project.tasksDone"), value: `${detail.doneTaskCount ?? 0}/${detail.taskCount ?? 0}` },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="size-4" /> {t("menu.projects")}
          </Link>
        </Button>
      </div>
      <PageHeader title={p.name ?? "-"} description={p.description ?? undefined}>
        {manage && (
          <>
            <Select value={p.status ?? ""} onValueChange={(s) => run(() => ProjectService.status(id, s as EProjectStatus), "common.saved")}>
              <SelectTrigger className="w-40" aria-label={t("crm.status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`project.status.${s}` as TranslationKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> {t("common.edit")}
            </Button>
          </>
        )}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={p.status} />
        {p.overdue && <Badge variant="destructive">{t("sales.overdue")}</Badge>}
      </div>

      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "overview" ? "" : v })}>
        <div className="overflow-x-auto">
          <TabsList>
            {(["overview", "tasks", "bugs", "milestones", "team", "attachments", "activity", "report"] as const).map((x) => (
              <TabsTrigger key={x} value={x}>
                {t(`project.tab.${x}` as TranslationKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className={`text-xl ${s.danger ? "text-destructive" : ""}`}>{s.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="grid gap-2">
              <div className="flex justify-between text-sm">
                <span>{t("project.progress")}</span>
                <span className="font-medium">{detail.progress ?? 0}%</span>
              </div>
              <Progress value={detail.progress ?? 0} aria-label={t("project.progress")} />
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{t("project.team")}</span>
                <People ids={team} name={name} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup type="single" variant="outline" value={taskMode} onValueChange={(v) => v && update({ mode: v === "list" ? "list" : "" })} aria-label={t("crm.viewMode")}>
              <ToggleGroupItem value="board" aria-label={t("crm.boardView")}>
                <Kanban className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label={t("crm.listView")}>
                <List className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            {taskManage && (
              <Button onClick={() => setTask({})}>
                <Plus className="size-4" /> {t("project.task.create")}
              </Button>
            )}
          </div>
          {!taskBoard ? (
            <Skeleton className="h-64 w-full" />
          ) : taskMode === "board" ? (
            <KanbanBoard
              canMove={taskManage}
              columns={taskBoard.map((c) => ({ id: c.stage?.id ?? "", name: `${c.stage?.name ?? ""}${c.stage?.done ? " ✓" : ""}`, cards: c.tasks ?? [] }))}
              onMove={(tid, stage, position) => run(() => TaskService.move(tid, stage, position))}
              renderCard={(x) => (
                <button type="button" className="bg-card flex w-full flex-col gap-1.5 rounded-md border p-3 text-left text-sm shadow-xs" onClick={() => setTask({ task: x })}>
                  <div className={`font-medium ${x.done ? "text-muted-foreground line-through" : ""}`}>{x.title}</div>
                  <div className="flex items-center justify-between gap-2">
                    <PriorityBadge priority={x.priority} />
                    <span className="text-muted-foreground text-xs">{formatDate(x.dueDate, language)}</span>
                  </div>
                  <People ids={x.assigneeIds} name={name} />
                </button>
              )}
            />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("project.task.title")}</TableHead>
                      <TableHead>{t("project.milestone.one")}</TableHead>
                      <TableHead>{t("crm.priority")}</TableHead>
                      <TableHead>{t("crm.stage")}</TableHead>
                      <TableHead>{t("project.task.assignees")}</TableHead>
                      <TableHead>{t("project.task.due")}</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">{t("common.actions")}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                          {t("project.task.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                    {allTasks.map((x) => (
                      <TableRow key={x.id}>
                        <TableCell>
                          <button type="button" className="font-medium hover:underline" onClick={() => setTask({ task: x })}>
                            {x.title}
                          </button>
                        </TableCell>
                        <TableCell>{milestoneName(x.milestoneId)}</TableCell>
                        <TableCell>
                          <PriorityBadge priority={x.priority} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={x.done ? "default" : "outline"}>{x.stageName}</Badge>
                        </TableCell>
                        <TableCell>
                          <People ids={x.assigneeIds} name={name} />
                        </TableCell>
                        <TableCell>{formatDate(x.dueDate, language)}</TableCell>
                        <TableCell>
                          {taskManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("crm.deleteNamed", { name: x.title ?? "" })}
                              onClick={() => setRemoving({ title: t("crm.confirm.deleteTask", { name: x.title ?? "" }), run: () => TaskService.remove(x.id!) })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bugs" className="flex flex-col gap-4">
          {taskManage && (
            <div className="flex justify-end">
              <Button onClick={() => setBug({})}>
                <Plus className="size-4" /> {t("project.bug.create")}
              </Button>
            </div>
          )}
          {!bugBoard ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <KanbanBoard
              canMove={taskManage}
              columns={bugBoard.map((c) => ({ id: c.stage?.id ?? "", name: c.stage?.name ?? "", cards: c.bugs ?? [] }))}
              onMove={(bid, stage, position) => run(() => BugService.move(bid, stage, position))}
              renderCard={(x) => (
                <div className="bg-card flex flex-col gap-1.5 rounded-md border p-3 text-sm shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => setBug({ bug: x })}>
                      {x.title}
                    </button>
                    {taskManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={t("crm.deleteNamed", { name: x.title ?? "" })}
                        onClick={() => setRemoving({ title: t("project.confirm.deleteBug", { name: x.title ?? "" }), run: () => BugService.remove(x.id!) })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <PriorityBadge priority={x.priority} />
                    <span className="text-muted-foreground text-xs">{x.assigneeId ? name(x.assigneeId) : ""}</span>
                  </div>
                </div>
              )}
            />
          )}
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("project.tab.milestones")}</CardTitle>
              {manage && (
                <Button variant="outline" size="sm" onClick={() => setMilestone({})}>
                  <Plus className="size-4" /> {t("project.milestone.create")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("project.task.title")}</TableHead>
                    <TableHead className="text-right">{t("project.milestone.cost")}</TableHead>
                    <TableHead>{t("crm.startDate")}</TableHead>
                    <TableHead>{t("crm.endDate")}</TableHead>
                    <TableHead>{t("crm.status")}</TableHead>
                    <TableHead className="w-40">{t("project.progress")}</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {milestones.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                        {t("crm.noEntries")}
                      </TableCell>
                    </TableRow>
                  )}
                  {milestones.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.title}</div>
                        {m.summary && <div className="text-muted-foreground line-clamp-1 text-xs">{m.summary}</div>}
                      </TableCell>
                      <TableCell className="text-right">{m.cost == null ? "-" : money(m.cost)}</TableCell>
                      <TableCell>{formatDate(m.startDate, language)}</TableCell>
                      <TableCell>{formatDate(m.endDate, language)}</TableCell>
                      <TableCell>
                        <MilestoneStatusBadge status={m.status} />
                      </TableCell>
                      <TableCell>
                        <Progress value={m.progress ?? 0} className="h-1.5" aria-label={t("project.progress")} />
                      </TableCell>
                      <TableCell>
                        {manage && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label={t("crm.editNamed", { name: m.title ?? "" })} onClick={() => setMilestone({ milestone: m })}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("crm.deleteNamed", { name: m.title ?? "" })}
                              onClick={() => setRemoving({ title: t("project.confirm.deleteMilestone", { name: m.title ?? "" }), run: () => ProjectService.removeMilestone(m.id!) })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("project.members")}</CardTitle>
              <CardDescription>{t("project.membersHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {team.length === 0 && <li className="text-muted-foreground">{t("crm.noEntries")}</li>}
                {team.map((uid) => (
                  <li key={uid} className="flex items-center justify-between">
                    <span>{name(uid)}</span>
                    <span className="text-muted-foreground text-xs">
                      {(() => {
                        const u = report?.users?.find((x) => x.userId === uid)
                        return u ? t("project.userProgress", { done: u.done ?? 0, assigned: u.assigned ?? 0 }) : ""
                      })()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("crm.clients")}</CardTitle>
              {manage && (
                <Button variant="outline" size="sm" onClick={() => setPickingClients(true)}>
                  <Pencil className="size-4" /> {t("crm.editList")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {(p.clientIds ?? []).length === 0 && <li className="text-muted-foreground text-sm">{t("crm.noEntries")}</li>}
                {(p.clientIds ?? []).map((cid) => (
                  <li key={cid}>
                    <Badge variant="secondary">{clientName(cid)}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("project.tab.attachments")}</CardTitle>
              {manage && (
                <>
                  <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} aria-label={t("crm.file.upload")} />
                  <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                    <Paperclip className="size-4" /> {t("crm.file.upload")}
                  </Button>
                </>
              )}
            </CardHeader>
            <CardContent>
              {(attachments ?? []).length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>}
              <ul className="flex flex-col gap-2">
                {(attachments ?? []).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                    <Paperclip className="text-muted-foreground size-4" />
                    <button type="button" className="flex-1 text-left hover:underline" onClick={() => openFile(a.fileId)}>
                      {a.name ?? `#${a.fileId}`}
                    </button>
                    <span className="text-muted-foreground text-xs">{formatDate(a.createdDate, language, true)}</span>
                    {manage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t("crm.deleteNamed", { name: a.name ?? "" })}
                        onClick={() => setRemoving({ title: t("crm.confirm.deleteEntry"), run: () => ProjectService.removeAttachment(a.id!) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent>
              {(activity ?? []).length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>}
              <ul className="flex flex-col gap-2">
                {(activity ?? []).map((a) => (
                  <li key={a.id} className="rounded-md border p-2 text-sm">
                    <div className="font-medium">{a.action}</div>
                    {a.detail && <div>{a.detail}</div>}
                    <div className="text-muted-foreground text-xs">
                      {name(a.actorUserId)} · {formatDate(a.createdDate, language, true)}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="flex flex-col gap-4">
          {!report ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardDescription>{t("crm.status")}</CardDescription>
                    <CardTitle className="text-xl">
                      <ProjectStatusBadge status={report.status} />
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>{t("project.report.budgetVsMilestones")}</CardDescription>
                    <CardTitle className="text-xl">
                      {report.budget == null ? "-" : money(report.budget)} / {money(report.milestoneCost ?? 0)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>{t("project.report.timeline")}</CardDescription>
                    <CardTitle className="text-base">
                      {formatDate(report.startDate, language)} – {formatDate(report.endDate, language)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>{t("project.progress")}</CardDescription>
                    <CardTitle className="text-xl">{report.progress ?? 0}%</CardTitle>
                  </CardHeader>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <CountCard
                  title={t("project.report.byStage")}
                  rows={(report.tasksByStage ?? []).map((s) => ({ label: s.stageName ?? "-", count: s.count ?? 0 }))}
                />
                <CountCard
                  title={t("project.report.byPriority")}
                  rows={(["HIGH", "MEDIUM", "LOW"] as const).map((x) => ({ label: t(`project.priority.${x}` as TranslationKey), count: report.tasksByPriority?.[x] ?? 0 }))}
                />
                <CountCard
                  title={t("project.report.milestones")}
                  rows={(["COMPLETE", "ONGOING", "INCOMPLETE"] as const).map((x) => ({
                    label: t(`project.milestone.status.${x}` as TranslationKey),
                    count: report.milestonesByStatus?.[x] ?? 0,
                  }))}
                />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("project.report.users")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {(report.users ?? []).length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>}
                  {(report.users ?? []).map((u) => (
                    <div key={u.userId} className="grid gap-1 text-sm">
                      <div className="flex justify-between">
                        <span>{name(u.userId)}</span>
                        <span className="text-muted-foreground">{t("project.userProgress", { done: u.done ?? 0, assigned: u.assigned ?? 0 })}</span>
                      </div>
                      <Progress value={u.progress ?? 0} className="h-1.5" aria-label={name(u.userId)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <ProjectFormDialog state={editing ? { project: p } : null} lookups={lookups} onClose={() => setEditing(false)} onSaved={reload} />
      <TaskDialog
        state={task}
        projectId={id}
        team={team}
        users={lookups.users}
        stages={taskStages}
        milestones={milestones}
        canEdit={taskManage}
        onClose={() => setTask(null)}
        onSaved={reload}
      />
      <BugDialog state={bug} projectId={id} team={team} users={lookups.users} stages={bugStages} onClose={() => setBug(null)} onSaved={reload} />
      <MilestoneDialog state={milestone} projectId={id} onClose={() => setMilestone(null)} onSaved={reload} />
      <PickDialog
        open={pickingClients}
        title={t("crm.clients")}
        options={lookups.customers.map((c) => ({ value: c.id ?? "", label: c.companyName ?? c.customerCode ?? "" }))}
        selected={p.clientIds ?? []}
        onClose={() => setPickingClients(false)}
        onSave={(ids) => run(() => ProjectService.clients(id, ids), "common.saved")}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(undefined)}
        title={removing?.title ?? ""}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (removing) await run(removing.run, "crm.done.deleted")
        }}
      />
    </div>
  )
}

function CountCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1">
            <div className="flex justify-between">
              <span>{r.label}</span>
              <span className="text-muted-foreground">{r.count}</span>
            </div>
            <div className="bg-muted h-1.5 rounded">
              <div className="bg-primary h-1.5 rounded" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
