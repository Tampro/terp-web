"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Ban, Copy, MoreHorizontal, Pencil, Play, Plus, Settings, Trash2, Video } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useUrlQuery } from "@/hooks/use-url-query"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import {
  EmployeeLookupService,
  ZoomService,
  type EmployeeOption,
  type ERecording,
  type EZoomStatus,
  type ZoomMeetingDto,
  type ZoomSettings,
} from "@/lib/meeting/zoom.service"

import { attempt, Field, today } from "../projects/_components/project-kit"

const STATUSES: EZoomStatus[] = ["SCHEDULED", "STARTED", "ENDED", "CANCELLED"]
const STATUS_VARIANT: Record<EZoomStatus, "default" | "secondary" | "outline" | "destructive"> = {
  SCHEDULED: "outline",
  STARTED: "default",
  ENDED: "secondary",
  CANCELLED: "destructive",
}
const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA")
}
const endOfNextMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 2, 0).toLocaleDateString("en-CA")
}

export default function MeetingsPage() {
  return (
    <React.Suspense>
      <Meetings />
    </React.Suspense>
  )
}

/**
 * §11.4 video meetings (Zoom): cards Scheduled / Started / Ended / Cancelled, list for a period, schedule / edit / start /
 * cancel / delete, Zoom settings (Account ID, Client ID, write-only secret, Test Connection).
 */
function Meetings() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("ZOOM_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const from = searchParams.get("from") ?? firstOfMonth()
  const to = searchParams.get("to") ?? endOfNextMonth()
  const status = (searchParams.get("status") as EZoomStatus | null) ?? undefined
  const [zoom, setZoom] = React.useState<{ configured?: boolean; enabled?: boolean }>()
  const [list, setList] = React.useState<ZoomMeetingDto[]>()
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([])
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState<{ meeting?: ZoomMeetingDto } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [pending, setPending] = React.useState<{ action: "delete" | "cancel"; row: ZoomMeetingDto }>()

  React.useEffect(() => {
    let cancelled = false
    ZoomService.status()
      .then((s) => !cancelled && setZoom(s))
      .catch((e: Error) => !cancelled && (setZoom({}), toast.error(e.message)))
    EmployeeLookupService.employees()
      .then((p) => !cancelled && setEmployees(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  React.useEffect(() => {
    let cancelled = false
    ZoomService.list({ from, to })
      .then((l) => !cancelled && setList(l ?? []))
      .catch((e: Error) => !cancelled && (setList([]), toast.error(e.message)))
    return () => {
      cancelled = true
    }
  }, [from, to, reloadKey])

  async function start(m: ZoomMeetingDto) {
    try {
      const r = await ZoomService.start(m.id!)
      if (r.startUrl?.startsWith("https://")) window.open(r.startUrl, "_blank", "noopener")
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }
  async function copyJoin(m: ZoomMeetingDto) {
    if (!m.joinUrl) return
    try {
      await navigator.clipboard.writeText(m.joinUrl)
      toast.success(t("form.linkCopied"))
    } catch {
      toast.message(m.joinUrl)
    }
  }

  const all = list ?? []
  const rows = status ? all.filter((m) => m.status === status) : all
  const count = (s: EZoomStatus) => all.filter((m) => m.status === s).length
  const ready = !!zoom?.enabled

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.meetings")} description={t("zoom.subtitle")}>
        {manage && (
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" /> {t("zoom.settings")}
          </Button>
        )}
        {manage && (
          <Button disabled={!ready} onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("zoom.create")}
          </Button>
        )}
      </PageHeader>
      {zoom && !ready && (
        <Alert>
          <Video className="size-4" />
          <AlertDescription>{t(zoom.configured ? "zoom.notVerified" : "zoom.notConfigured")}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <button key={s} type="button" className="text-left" aria-pressed={status === s} onClick={() => update({ status: status === s ? "" : s })}>
            <Card className={status === s ? "ring-primary ring-2" : undefined}>
              <CardHeader>
                <CardDescription>{t(`zoom.status.${s}` as TranslationKey)}</CardDescription>
                <CardTitle className="text-2xl">{list ? count(s) : "-"}</CardTitle>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={from} onChange={(e) => update({ from: e.target.value })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={to} onChange={(e) => update({ to: e.target.value })} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("zoom.topic")}</TableHead>
                  <TableHead>{t("pos.date")}</TableHead>
                  <TableHead>{t("crm.time")}</TableHead>
                  <TableHead>{t("zoom.invitees")}</TableHead>
                  <TableHead>{t("crm.status")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!list && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {list && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      {t("zoom.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((m) => {
                  const open = m.status === "SCHEDULED" || m.status === "STARTED"
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.topic}</div>
                        {m.agenda && <div className="text-muted-foreground line-clamp-1 text-xs">{m.agenda}</div>}
                      </TableCell>
                      <TableCell>{formatDate(m.startDate, language)}</TableCell>
                      <TableCell>
                        {m.startTime?.slice(0, 5)}–{m.endTime?.slice(0, 5)}
                      </TableCell>
                      <TableCell>{(m.invitees ?? []).map((p) => p.fullName).join(", ") || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[m.status ?? "SCHEDULED"]}>{t(`zoom.status.${m.status ?? "SCHEDULED"}` as TranslationKey)}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("crm.actionsFor", { name: m.topic ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {m.joinUrl && (
                              <DropdownMenuItem onClick={() => copyJoin(m)}>
                                <Copy className="size-4" /> {t("zoom.copyJoin")}
                              </DropdownMenuItem>
                            )}
                            {manage && open && (
                              <>
                                <DropdownMenuItem onClick={() => start(m)}>
                                  <Play className="size-4" /> {t("zoom.start")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditing({ meeting: m })}>
                                  <Pencil className="size-4" /> {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPending({ action: "cancel", row: m })}>
                                  <Ban className="size-4" /> {t("zoom.cancel")}
                                </DropdownMenuItem>
                              </>
                            )}
                            {manage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: m })}>
                                  <Trash2 className="size-4" /> {t("common.delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <MeetingDialog state={editing} employees={employees} onClose={() => setEditing(null)} onSaved={reload} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={reload} />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(pending?.action === "cancel" ? "zoom.confirm.cancel" : "zoom.confirm.delete", { name: pending?.row.topic ?? "" })}
        description={t(pending?.action === "cancel" ? "zoom.confirm.cancelDesc" : "crm.confirm.deleteDesc")}
        confirmLabel={t(pending?.action === "cancel" ? "zoom.cancel" : "common.delete")}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const ok =
            pending.action === "cancel"
              ? await attempt(() => ZoomService.setStatus(id, "CANCELLED"), t("common.saved"))
              : await attempt(() => ZoomService.remove(id), t("crm.done.deleted"))
          if (ok) reload()
        }}
      />
    </div>
  )
}

type T = ReturnType<typeof useT>
const RECORDINGS: ERecording[] = ["NONE", "LOCAL", "CLOUD"]
// Limits from meeting-service ZoomMeetingService.MeetingForm.
const meetingSchema = (t: T) =>
  z.object({
    topic: z.string().trim().min(1, t("project.v.required")).max(200, t("sales.v.max", { n: 200 })),
    startDate: z.string().min(1, t("sales.v.date")),
    startTime: z.string().min(1, t("zoom.v.time")),
    durationMinutes: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1440, t("zoom.v.duration")),
    passcode: z.string().refine((v) => v === "" || /^[A-Za-z0-9@_*-]{1,10}$/.test(v), t("zoom.v.passcode")),
    agenda: z.string().max(2000, t("sales.v.max", { n: 2000 })),
    inviteeIds: z.array(z.string()).max(300),
    hostVideo: z.boolean(),
    participantVideo: z.boolean(),
    waitingRoom: z.boolean(),
    autoRecording: z.enum(["NONE", "LOCAL", "CLOUD"]),
  })
type TMeeting = z.infer<ReturnType<typeof meetingSchema>>

/** §11.4 form: title, description, password, start time, duration, host / participant video, waiting room, recording, participants. */
function MeetingDialog({ state, employees, onClose, onSaved }: { state: { meeting?: ZoomMeetingDto } | null; employees: EmployeeOption[]; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const m = state?.meeting
  const values = React.useMemo<TMeeting>(
    () => ({
      topic: m?.topic ?? "",
      startDate: m?.startDate ?? today(),
      startTime: m?.startTime?.slice(0, 5) ?? "09:00",
      durationMinutes: String(m?.durationMinutes ?? 30),
      passcode: "",
      agenda: m?.agenda ?? "",
      inviteeIds: (m?.invitees ?? []).map((p) => p.id ?? ""),
      hostVideo: m?.hostVideo ?? false,
      participantVideo: m?.participantVideo ?? false,
      waitingRoom: m?.waitingRoom ?? false,
      autoRecording: m?.autoRecording ?? "NONE",
    }),
    [m]
  )
  const form = useForm<TMeeting>({ resolver: zodResolver(meetingSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            const body = {
              topic: v.topic.trim(),
              startDate: v.startDate,
              startTime: v.startTime,
              durationMinutes: Number(v.durationMinutes),
              ...(v.passcode ? { passcode: v.passcode } : {}),
              inviteeIds: v.inviteeIds.map(Number),
              agenda: v.agenda.trim() || null,
              hostVideo: v.hostVideo,
              participantVideo: v.participantVideo,
              waitingRoom: v.waitingRoom,
              autoRecording: v.autoRecording,
            }
            if (await attempt(() => (m?.id ? ZoomService.update(m.id, body) : ZoomService.create(body)), t("common.saved"))) {
              onSaved()
              onClose()
            }
          })}
        >
          <DialogHeader>
            <DialogTitle>{t(m ? "zoom.edit" : "zoom.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("menu.meetings")}</DialogDescription>
          </DialogHeader>
          <Field id="zm-topic" label={t("zoom.topic")} error={errors.topic?.message}>
            <Input id="zm-topic" {...form.register("topic")} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field id="zm-date" label={t("pos.date")} error={errors.startDate?.message}>
              <Input id="zm-date" type="date" {...form.register("startDate")} />
            </Field>
            <Field id="zm-time" label={t("crm.time")} error={errors.startTime?.message}>
              <Input id="zm-time" type="time" {...form.register("startTime")} />
            </Field>
            <Field id="zm-duration" label={t("zoom.duration")} error={errors.durationMinutes?.message}>
              <Input id="zm-duration" inputMode="numeric" {...form.register("durationMinutes")} />
            </Field>
          </div>
          <Field id="zm-passcode" label={t("zoom.passcode")} error={errors.passcode?.message}>
            <Input id="zm-passcode" placeholder={t(m ? "zoom.passcodeKeep" : "zoom.passcodeRandom")} {...form.register("passcode")} />
          </Field>
          <Field id="zm-agenda" label={t("crm.description")} error={errors.agenda?.message}>
            <Textarea id="zm-agenda" rows={2} {...form.register("agenda")} />
          </Field>
          <div className="grid gap-1.5">
            <Label>{t("zoom.invitees")}</Label>
            <Controller
              control={form.control}
              name="inviteeIds"
              render={({ field }) => (
                <div className="grid max-h-32 gap-1.5 overflow-y-auto rounded-md border p-2">
                  {employees.length === 0 && <p className="text-muted-foreground text-sm">{t("zoom.noEmployees")}</p>}
                  {employees.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value.includes(e.id ?? "")} onCheckedChange={(c) => field.onChange(c === true ? [...field.value, e.id ?? ""] : field.value.filter((x) => x !== e.id))} />
                      {e.fullName}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["hostVideo", "participantVideo", "waitingRoom"] as const).map((k) => (
              <Controller
                key={k}
                control={form.control}
                name={k}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} /> {t(`zoom.${k}` as TranslationKey)}
                  </label>
                )}
              />
            ))}
            <Controller
              control={form.control}
              name="autoRecording"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label={t("zoom.recording")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORDINGS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`zoom.recordingOf.${r}` as TranslationKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Zoom settings: Account ID, Client ID, Client Secret (write-only: empty keeps the stored one), Test Connection. */
function SettingsDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{open && <SettingsForm onClose={onClose} onSaved={onSaved} t={t} />}</DialogContent>
    </Dialog>
  )
}

function SettingsForm({ onClose, onSaved, t }: { onClose: () => void; onSaved: () => void; t: T }) {
  const [s, setS] = React.useState<ZoomSettings>()
  const [accountId, setAccountId] = React.useState("")
  const [clientId, setClientId] = React.useState("")
  const [secret, setSecret] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [errors, setErrors] = React.useState<{ accountId?: string; clientId?: string; secret?: string }>({})
  React.useEffect(() => {
    let cancelled = false
    ZoomService.settings()
      .then((x) => {
        if (cancelled) return
        setS(x ?? {})
        setAccountId(x?.accountId ?? "")
        setClientId(x?.clientId ?? "")
      })
      .catch(() => !cancelled && setS({}))
    return () => {
      cancelled = true
    }
  }, [])
  async function save(test: boolean) {
    const errs = {
      accountId: !accountId.trim() ? t("project.v.required") : undefined,
      clientId: !clientId.trim() ? t("project.v.required") : undefined,
      secret: !secret && !s?.clientSecretSet ? t("project.v.required") : undefined,
    }
    setErrors(errs)
    if (errs.accountId || errs.clientId || errs.secret) return
    setBusy(true)
    const ok = await attempt(async () => {
      await ZoomService.saveSettings({ accountId: accountId.trim(), clientId: clientId.trim(), ...(secret ? { clientSecret: secret } : {}) })
      if (test) await ZoomService.testSettings()
    }, t(test ? "zoom.done.tested" : "common.saved"))
    setBusy(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }
  if (!s) return <Skeleton className="h-40 w-full" />
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("zoom.settings")}</DialogTitle>
        <DialogDescription>{t(s.verified ? "zoom.verified" : "zoom.settingsDesc")}</DialogDescription>
      </DialogHeader>
      <Field id="zs-account" label={t("zoom.accountId")} error={errors.accountId}>
        <Input id="zs-account" value={accountId} maxLength={100} onChange={(e) => setAccountId(e.target.value)} />
      </Field>
      <Field id="zs-client" label={t("zoom.clientId")} error={errors.clientId}>
        <Input id="zs-client" value={clientId} maxLength={100} onChange={(e) => setClientId(e.target.value)} />
      </Field>
      <Field id="zs-secret" label={t("zoom.clientSecret")} error={errors.secret}>
        <Input
          id="zs-secret"
          type="password"
          autoComplete="new-password"
          value={secret}
          maxLength={200}
          placeholder={s.clientSecretSet ? t("zoom.secretKeep") : ""}
          onChange={(e) => setSecret(e.target.value)}
        />
      </Field>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => save(false)}>
          {t("common.save")}
        </Button>
        <Button type="button" disabled={busy} onClick={() => save(true)}>
          {t("zoom.saveAndTest")}
        </Button>
      </DialogFooter>
    </div>
  )
}
