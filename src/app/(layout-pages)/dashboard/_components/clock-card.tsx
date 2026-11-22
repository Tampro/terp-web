"use client"

import * as React from "react"
import { Clock, LogIn, LogOut } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { ClockService, type ClockToday } from "@/lib/attendance/clock.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { HrStatus } from "../../hrm/_components/crud-kit"

const hm = (t?: string | null) => (t ? t.slice(0, 5) : "--:--")

/** Current time, ticking every 30 s (browser state read with useSyncExternalStore, not setState in an effect). */
function useNow() {
  const subscribe = React.useCallback((cb: () => void) => {
    const id = setInterval(cb, 30_000)
    return () => clearInterval(id)
  }, [])
  // the snapshot is the current time rounded to 30 s, so it stays stable between ticks
  const snap = React.useCallback(() => Math.floor(Date.now() / 30_000) * 30_000, [])
  const ms = React.useSyncExternalStore(subscribe, snap, () => 0)
  return new Date(ms)
}

/**
 * §5 Staff: today's attendance with Clock In / Clock Out (once per day; the backend computes late / early / overtime and
 * closes a missing clock-out at the shift end). Shown to users with ATTENDANCE_SELF.
 */
export function ClockCard() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const now = useNow()
  const [state, setState] = React.useState<{ data?: ClockToday; error?: string; noProfile?: boolean }>()
  const [reload, setReload] = React.useState(0)
  const [notes, setNotes] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [timeZone, setTimeZone] = React.useState<string>()

  React.useEffect(() => {
    let cancelled = false
    ClockService.timeZone()
      .then((z) => !cancelled && setTimeZone(z))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    ClockService.today()
      .then((data) => !cancelled && setState({ data }))
      .catch((e: unknown) => {
        if (cancelled) return
        // no employee profile linked to this account (ATT_060, or EMP_001 from employee-service)
        const noProfile = e instanceof ApiError && (e.code === "ATT_060" || e.code === "EMP_001")
        setState({ error: e instanceof Error ? e.message : String(e), noProfile })
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  async function clock(kind: "in" | "out") {
    setBusy(true)
    try {
      await (kind === "in" ? ClockService.clockIn(notes.trim() || undefined) : ClockService.clockOut(notes.trim() || undefined))
      toast.success(t(kind === "in" ? "clock.inDone" : "clock.outDone"))
      setNotes("")
      setReload((x) => x + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const d = state?.data
  const r = d?.record
  const s = d?.shift
  return (
    <Card data-testid="clock-card">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-5" /> {t("clock.title")}
          </CardTitle>
          <CardDescription>
            {formatDate(d?.date ?? now.toLocaleDateString("en-CA", { timeZone }), language)} ·{" "}
            <span data-testid="clock-now">{now.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", timeZone })}</span>
            {timeZone && <span className="ml-1 text-xs">({timeZone})</span>}
          </CardDescription>
        </div>
        {s && (
          <Badge variant="outline" data-testid="clock-shift">
            {s.name} · {hm(s.startTime)}–{hm(s.endTime)}
            {s.nightShift ? ` · ${t("hr.f.nightShift")}` : ""}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {!state ? (
          <Skeleton className="h-20 w-full" />
        ) : state.error ? (
          <p className="text-muted-foreground text-sm" role="note">
            {state.noProfile ? t("clock.noProfile") : state.error}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground text-xs">{t("hr.f.clockIn")}</p>
                <p className="text-xl font-semibold" data-testid="clock-in-time">
                  {hm(r?.clockIn)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("hr.f.clockOut")}</p>
                <p className="text-xl font-semibold" data-testid="clock-out-time">
                  {hm(r?.clockOut)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("hr.f.totalHours")}</p>
                <p className="text-xl font-semibold">{r?.totalHours != null ? r.totalHours.toFixed(2) : "-"}</p>
              </div>
              <div className="flex flex-wrap content-start gap-1">
                {r?.clockIn && r.status && <HrStatus status={r.status} />}
                {r?.late && <Badge variant="destructive">{t("hr.att.late")}</Badge>}
                {r?.earlyDeparture && <Badge variant="destructive">{t("hr.att.early")}</Badge>}
                {!!r?.overtimeHours && <Badge variant="secondary">{t("clock.overtime", { h: r.overtimeHours.toFixed(2) })}</Badge>}
                {r?.autoClockedOut && <Badge variant="outline">{t("clock.autoOut")}</Badge>}
              </div>
            </div>
            {s && !r?.clockIn && <p className="text-muted-foreground text-xs">{t("clock.grace", { n: s.gracePeriodMinutes ?? 0 })}</p>}
            {(d?.canClockIn || d?.canClockOut) && (
              <div className="flex flex-wrap items-center gap-2">
                <Input className="min-w-48 flex-1" maxLength={500} aria-label={t("clock.notes")} placeholder={t("clock.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
                {d?.canClockIn && (
                  <Button key="in" disabled={busy} onClick={() => clock("in")}>
                    <LogIn className="size-4" /> {t("clock.in")}
                  </Button>
                )}
                {d?.canClockOut && (
                  <Button key="out" variant="secondary" disabled={busy} onClick={() => clock("out")}>
                    <LogOut className="size-4" /> {t("clock.out")}
                  </Button>
                )}
              </div>
            )}
            {!d?.canClockIn && !d?.canClockOut && r?.clockOut && <p className="text-muted-foreground text-sm">{t("clock.doneToday")}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
