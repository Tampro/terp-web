"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Handshake, Paperclip, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import { useAuthStore } from "@/lib/auth/auth.store"
import {
  crmRecord,
  DealService,
  LeadService,
  type Activity,
  type CallDto,
  type DealDetail,
  type EDealStatus,
  type ELinkKind,
  type EntryDto,
  type ESubjectPath,
  type LeadDetail,
  type LinkDto,
  type TaskDto,
} from "@/lib/crm/crm.service"
import { formatDate } from "@/lib/format"
import { MediaService } from "@/lib/media/media.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { CallDialog, EmailDialog, TaskDialog } from "./activity-dialogs"
import { ConvertDialog } from "./convert-dialog"
import { attempt, DealStatusBadge, errorMessage, LabelChips, PickDialog } from "./crm-kit"
import { DealFormDialog } from "./deal-form-dialog"
import { LeadFormDialog } from "./lead-form-dialog"
import { useCrmLookups, userName } from "./use-crm-lookups"

type Detail = { kind: "leads"; data: LeadDetail } | { kind: "deals"; data: DealDetail }
type Removing = { title: string; run: () => Promise<unknown> }

/**
 * §7.2 / §7.3 lead or deal detail: General (notes, emails, discussion), Tasks, Users, Products, Sources, Files, Calls,
 * Activity, and Clients for deals. Every change reloads the detail (the backend writes the activity log).
 */
export function RecordDetail({ subject, id }: { subject: ESubjectPath; id: string }) {
  const t = useT()
  const router = useRouter()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const me = useAuthStore((s) => s.me)
  const manage = !!me?.permissions?.includes("CRM_MANAGE")
  const lookups = useCrmLookups()
  const api = React.useMemo(() => crmRecord(subject), [subject])
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") ?? "general"

  const [detail, setDetail] = React.useState<Detail>()
  const [error, setError] = React.useState<string>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState(false)
  const [converting, setConverting] = React.useState(false)
  const [task, setTask] = React.useState<{ task?: TaskDto } | null>(null)
  const [call, setCall] = React.useState<{ call?: CallDto } | null>(null)
  const [emailing, setEmailing] = React.useState(false)
  const [picking, setPicking] = React.useState<ELinkKind>()
  const [removing, setRemoving] = React.useState<Removing>()
  const [discussion, setDiscussion] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const fileInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false
    const load: Promise<Detail> =
      subject === "leads"
        ? LeadService.get(id).then((data) => ({ kind: "leads", data }))
        : DealService.get(id).then((data) => ({ kind: "deals", data }))
    load
      .then((d) => !cancelled && (setDetail(d), setError(undefined)))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [subject, id, reloadKey])

  const run = async (fn: () => Promise<unknown>, done?: TranslationKey) => {
    const ok = await attempt(fn, done ? t(done) : undefined)
    if (ok) reload()
    return ok
  }

  if (error)
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  if (!detail)
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  const lead = detail.kind === "leads" ? detail.data.lead : undefined
  const deal = detail.kind === "deals" ? detail.data.deal : undefined
  const row = lead ?? deal ?? {}
  const notes = detail.data.notes
  const a: Activity = detail.data.activity ?? {}
  const pipeline = lookups.pipelines.find((p) => p.id === row.pipelineId)
  const stages = (lead ? pipeline?.leadStages : pipeline?.dealStages) ?? []
  const labelColors = Object.fromEntries(lookups.labels.map((l) => [l.id ?? "", l.color ?? ""]))
  const backHref = `/crm/${subject}`

  const pickOptions: Record<ELinkKind, { value: string; label: string }[]> = {
    members: lookups.users.map((u) => ({ value: u.id ?? "", label: u.fullName || u.username || "" })),
    clients: lookups.customers.map((c) => ({ value: c.id ?? "", label: c.companyName ?? c.customerCode ?? "" })),
    labels: lookups.labels.filter((l) => l.pipelineId === row.pipelineId).map((l) => ({ value: l.id ?? "", label: l.name ?? "" })),
    sources: lookups.sources.map((s) => ({ value: s.id ?? "", label: s.name ?? "" })),
    products: lookups.items.map((i) => ({ value: i.id ?? "", label: i.name ?? "" })),
  }
  const linked: Record<ELinkKind, LinkDto[] | undefined> = {
    members: a.members,
    clients: a.clients,
    labels: a.labels,
    sources: a.sources,
    products: a.products,
  }

  async function openFile(entry: EntryDto) {
    if (!entry.mediaFileId) return
    try {
      const f = await MediaService.file(entry.mediaFileId)
      if (f.viewUrl?.startsWith("http")) window.open(f.viewUrl, "_blank", "noopener")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const uploaded = await MediaService.upload([...files])
      for (const f of uploaded) if (f.id) await api.addFile(id, f.id)
      toast.success(t("crm.done.fileAdded"))
      reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const linkTab = (kind: ELinkKind) => (
    <TabsContent value={kind}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t(`crm.tab.${kind}` as TranslationKey)}</CardTitle>
          {manage && (
            <Button variant="outline" size="sm" onClick={() => setPicking(kind)}>
              <Pencil className="size-4" /> {t("crm.editList")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {(linked[kind] ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {(linked[kind] ?? []).map((l) => (
                <li key={l.refId}>
                  <Badge variant="secondary">{l.name ?? `#${l.refId}`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )

  const entryList = (entries: EntryDto[] | undefined, removable: boolean) =>
    (entries ?? []).length === 0 ? (
      <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>
    ) : (
      <ul className="flex flex-col gap-3">
        {(entries ?? []).map((e) => (
          <li key={e.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
            <div className="flex-1">
              {e.title && <div className="font-medium">{e.title}</div>}
              {e.emailTo && <div className="text-muted-foreground text-xs">{t("crm.email.toLine", { to: e.emailTo })}</div>}
              {e.body && <p className="whitespace-pre-wrap">{e.body}</p>}
              <div className="text-muted-foreground mt-1 text-xs">
                {e.authorName ? `${e.authorName} · ` : ""}
                {formatDate(e.createdDate, language, true)}
              </div>
            </div>
            {manage && removable && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t("crm.deleteNamed", { name: e.title ?? t("crm.entry") })}
                onClick={() => setRemoving({ title: t("crm.confirm.deleteEntry"), run: () => api.removeEntry(id, e.id!) })}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    )

  const info: { label: string; value: React.ReactNode }[] = lead
    ? [
        { label: t("crm.email"), value: lead.email ?? "-" },
        { label: t("crm.subject"), value: lead.subject ?? "-" },
        { label: t("crm.owner"), value: userName(lookups.users, lead.ownerUserId) },
        { label: t("crm.phone"), value: lead.phone || "-" },
        {
          label: t("crm.followUp"),
          value: <span className={lead.followUpOverdue ? "text-destructive" : undefined}>{formatDate(lead.followUpDate, language)}</span>,
        },
        { label: t("crm.pipeline"), value: pipeline?.name ?? "-" },
        { label: t("crm.created"), value: formatDate(lead.createdDate, language) },
      ]
    : [
        { label: t("crm.price"), value: money(deal?.price) },
        { label: t("crm.status"), value: <DealStatusBadge status={deal?.status} /> },
        { label: t("crm.phone"), value: deal?.phone || "-" },
        { label: t("crm.clients"), value: (deal?.clients ?? []).map((c) => c.name).join(", ") || "-" },
        { label: t("crm.pipeline"), value: pipeline?.name ?? "-" },
        {
          label: t("crm.fromLead"),
          value: deal?.fromLeadId ? (
            <Link className="text-primary underline" href={`/crm/leads/${deal.fromLeadId}`}>
              {t("crm.action.view")}
            </Link>
          ) : (
            "-"
          ),
        },
        { label: t("crm.created"), value: formatDate(deal?.createdDate, language) },
      ]

  const tabs: { value: string; label: TranslationKey; count?: number }[] = [
    { value: "general", label: "crm.tab.general" },
    { value: "tasks", label: "crm.tab.tasks", count: a.tasks?.length },
    { value: "members", label: "crm.tab.members", count: a.members?.length },
    ...(deal ? [{ value: "clients", label: "crm.tab.clients" as TranslationKey, count: a.clients?.length }] : []),
    { value: "products", label: "crm.tab.products", count: a.products?.length },
    { value: "sources", label: "crm.tab.sources", count: a.sources?.length },
    { value: "files", label: "crm.tab.files", count: a.files?.length },
    { value: "calls", label: "crm.tab.calls", count: a.calls?.length },
    { value: "activity", label: "crm.tab.activity" },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="size-4" /> {t(subject === "leads" ? "menu.crm.leads" : "menu.crm.deals")}
          </Link>
        </Button>
      </div>
      <PageHeader title={row.name ?? "-"} description={lead ? t("crm.lead.detail") : t("crm.deal.detail")}>
        {manage && stages.length > 0 && (
          <Select
            value={row.stageId ?? ""}
            onValueChange={(s) =>
              run(() => (lead ? LeadService.move(id, s) : DealService.move(id, s)), "crm.done.moved")
            }
          >
            <SelectTrigger className="w-44" aria-label={t("crm.stage")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id ?? ""}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {manage && deal && (
          <Select value={deal.status ?? ""} onValueChange={(s) => run(() => DealService.status(id, s as EDealStatus), "common.saved")}>
            <SelectTrigger className="w-36" aria-label={t("crm.status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["ACTIVE", "WON", "LOSS"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`crm.dealStatus.${s}` as TranslationKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {manage && lead && !lead.convertedDealId && (
          <Button variant="secondary" onClick={() => setConverting(true)}>
            <Handshake className="size-4" /> {t("crm.action.convert")}
          </Button>
        )}
        {lead?.convertedDealId && (
          <Button variant="secondary" asChild>
            <Link href={`/crm/deals/${lead.convertedDealId}`}>
              <Handshake className="size-4" /> {t("crm.alreadyConverted")}
            </Link>
          </Button>
        )}
        {manage && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> {t("common.edit")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{row.stageName ?? "-"}</Badge>
        <LabelChips labels={row.labels} colors={labelColors} />
      </div>

      <Tabs value={tab} onValueChange={(v) => update({ tab: v })}>
        <div className="overflow-x-auto">
          <TabsList>
            {tabs.map((x) => (
              <TabsTrigger key={x.value} value={x.value}>
                {t(x.label)}
                {x.count ? <span className="text-muted-foreground ml-1 text-xs">({x.count})</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="general" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">{t("crm.info")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                {info.map((f) => (
                  <div key={f.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="text-right">{f.value}</dd>
                  </div>
                ))}
              </dl>
              {notes && (
                <div className="mt-4 border-t pt-3 text-sm">
                  <div className="text-muted-foreground mb-1">{t("crm.notes")}</div>
                  <p className="whitespace-pre-wrap">{notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t("crm.emails")}</CardTitle>
                {manage && (
                  <Button variant="outline" size="sm" onClick={() => setEmailing(true)}>
                    <Plus className="size-4" /> {t("crm.email.create")}
                  </Button>
                )}
              </CardHeader>
              <CardContent>{entryList(a.emails, true)}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("crm.discussion")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {manage && (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const c = discussion.trim()
                      if (!c) return
                      if (c.length > 5000) return toast.error(t("crm.v.max", { n: 5000 }))
                      if (await run(() => api.addDiscussion(id, c))) setDiscussion("")
                    }}
                  >
                    <Textarea
                      rows={2}
                      value={discussion}
                      onChange={(e) => setDiscussion(e.target.value)}
                      placeholder={t("crm.discussion.placeholder")}
                      aria-label={t("crm.discussion")}
                    />
                    <div>
                      <Button type="submit" size="sm" disabled={!discussion.trim()}>
                        {t("crm.discussion.add")}
                      </Button>
                    </div>
                  </form>
                )}
                {entryList(a.discussions, true)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("crm.tab.tasks")}</CardTitle>
              {manage && (
                <Button variant="outline" size="sm" onClick={() => setTask({})}>
                  <Plus className="size-4" /> {t("crm.task.create")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("crm.name")}</TableHead>
                    <TableHead>{t("crm.date")}</TableHead>
                    <TableHead>{t("crm.time")}</TableHead>
                    <TableHead>{t("crm.priority")}</TableHead>
                    <TableHead>{t("crm.status")}</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(a.tasks ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground h-16 text-center">
                        {t("crm.noEntries")}
                      </TableCell>
                    </TableRow>
                  )}
                  {(a.tasks ?? []).map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className={x.status === "DONE" ? "text-muted-foreground line-through" : undefined}>{x.name}</TableCell>
                      <TableCell>{formatDate(x.date, language)}</TableCell>
                      <TableCell>{x.time?.slice(0, 5) ?? "-"}</TableCell>
                      <TableCell>{x.priority ? t(`crm.priorityOf.${x.priority}` as TranslationKey) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={x.status === "DONE" ? "default" : "outline"}>
                          {x.status ? t(`crm.taskStatus.${x.status}` as TranslationKey) : "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {manage && (
                          <ItemButtons
                            name={x.name ?? ""}
                            onEdit={() => setTask({ task: x })}
                            onRemove={() =>
                              setRemoving({ title: t("crm.confirm.deleteTask", { name: x.name ?? "" }), run: () => api.removeTask(id, x.id!) })
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {linkTab("members")}
        {deal && linkTab("clients")}
        {linkTab("products")}
        {linkTab("sources")}

        <TabsContent value="files">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("crm.tab.files")}</CardTitle>
              {manage && (
                <>
                  <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} aria-label={t("crm.file.upload")} />
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    <Paperclip className="size-4" /> {t("crm.file.upload")}
                  </Button>
                </>
              )}
            </CardHeader>
            <CardContent>
              {(a.files ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(a.files ?? []).map((f) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                      <Paperclip className="text-muted-foreground size-4" />
                      <button type="button" className="flex-1 text-left hover:underline" onClick={() => openFile(f)}>
                        {f.title ?? `#${f.mediaFileId}`}
                      </button>
                      <span className="text-muted-foreground text-xs">{formatDate(f.createdDate, language, true)}</span>
                      {manage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t("crm.deleteNamed", { name: f.title ?? "" })}
                          onClick={() => setRemoving({ title: t("crm.confirm.deleteEntry"), run: () => api.removeEntry(id, f.id!) })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("crm.tab.calls")}</CardTitle>
              {manage && (
                <Button variant="outline" size="sm" onClick={() => setCall({})}>
                  <Plus className="size-4" /> {t("crm.call.create")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("crm.subject")}</TableHead>
                    <TableHead>{t("crm.call.type")}</TableHead>
                    <TableHead>{t("crm.call.duration")}</TableHead>
                    <TableHead>{t("crm.call.assignee")}</TableHead>
                    <TableHead>{t("crm.call.result")}</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(a.calls ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground h-16 text-center">
                        {t("crm.noEntries")}
                      </TableCell>
                    </TableRow>
                  )}
                  {(a.calls ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.subject}</div>
                        {c.description && <div className="text-muted-foreground text-xs">{c.description}</div>}
                      </TableCell>
                      <TableCell>{c.callType ? t(`crm.callType.${c.callType}` as TranslationKey) : "-"}</TableCell>
                      <TableCell>{c.duration || "-"}</TableCell>
                      <TableCell>{userName(lookups.users, c.assigneeUserId)}</TableCell>
                      <TableCell className="max-w-60 truncate">{c.callResult || "-"}</TableCell>
                      <TableCell>
                        {manage && (
                          <ItemButtons
                            name={c.subject ?? ""}
                            onEdit={() => setCall({ call: c })}
                            onRemove={() =>
                              setRemoving({ title: t("crm.confirm.deleteCall", { name: c.subject ?? "" }), run: () => api.removeCall(id, c.id!) })
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent>{entryList(a.activity, false)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {lead && (
        <LeadFormDialog
          state={editing ? { detail: detail.data as LeadDetail } : null}
          lookups={lookups}
          meId={me?.userId}
          onClose={() => setEditing(false)}
          onSaved={reload}
        />
      )}
      {deal && (
        <DealFormDialog
          state={editing ? { detail: detail.data as DealDetail } : null}
          lookups={lookups}
          onClose={() => setEditing(false)}
          onSaved={reload}
        />
      )}
      <ConvertDialog
        lead={converting ? lead : undefined}
        lookups={lookups}
        onClose={() => setConverting(false)}
        onConverted={(dealId) => (dealId ? router.push(`/crm/deals/${dealId}`) : reload())}
      />
      <TaskDialog
        state={task}
        onClose={() => setTask(null)}
        onSave={(body, taskId) => run(() => (taskId ? api.updateTask(id, taskId, body) : api.addTask(id, body)), "common.saved")}
      />
      <CallDialog
        state={call}
        users={lookups.users}
        onClose={() => setCall(null)}
        onSave={(body, callId) => run(() => (callId ? api.updateCall(id, callId, body) : api.addCall(id, body)), "common.saved")}
      />
      <EmailDialog
        open={emailing}
        defaultTo={lead?.email}
        onClose={() => setEmailing(false)}
        onSave={(body) => run(() => api.addEmail(id, body), "common.saved")}
      />
      <PickDialog
        open={!!picking}
        title={picking ? t(`crm.tab.${picking}` as TranslationKey) : ""}
        options={picking ? pickOptions[picking] : []}
        selected={picking ? (linked[picking] ?? []).map((l) => l.refId ?? "") : []}
        onClose={() => setPicking(undefined)}
        onSave={(ids) => run(() => api.setLinks(id, picking!, ids), "common.saved")}
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

function ItemButtons({ name, onEdit, onRemove }: { name: string; onEdit: () => void; onRemove: () => void }) {
  const t = useT()
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" className="size-7" aria-label={t("crm.editNamed", { name })} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-7" aria-label={t("crm.deleteNamed", { name })} onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
