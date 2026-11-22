"use client"

import * as React from "react"
import { Download, GitCompare, Lock, MoreHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { BalanceSheetService, YearEndService, type CloseDto, type CompareDto, type SheetDto } from "@/lib/accounting/ledger.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { saveBlob } from "@/lib/pos/pos.service"

import { attempt, errorMessage, Field, PlainSelect, today } from "../_components/acc-kit"

const PAGE_SIZE = 20
type Money = (n?: number | null) => string

export default function BalanceSheetsPage() {
  return (
    <React.Suspense>
      <BalanceSheets />
    </React.Suspense>
  )
}

/** §13 balance sheet (Draft → Finalised, compare two finalised) and year-end close, one page with two tabs. */
function BalanceSheets() {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") === "year-end" ? "year-end" : "sheets"
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.le.closing")} description={t("le.closing.subtitle")} />
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "sheets" ? "" : v, page: 0 })}>
        <TabsList>
          <TabsTrigger value="sheets">{t("le.sheets")}</TabsTrigger>
          <TabsTrigger value="year-end">{t("le.yearEnd")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "sheets" ? <SheetList /> : <YearEnd />}
    </div>
  )
}

function SheetList() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const close = !!useAuthStore((s) => s.me?.permissions)?.includes("LEDGER_CLOSE")
  const { searchParams, update } = useUrlQuery()
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<SheetDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [generating, setGenerating] = React.useState(false)
  const [viewing, setViewing] = React.useState<string>()
  const [pending, setPending] = React.useState<{ action: "finalise" | "delete" | "regenerate"; row: SheetDto }>()
  const [comparing, setComparing] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    BalanceSheetService.list({ page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, reloadKey])

  async function download(s: SheetDto) {
    try {
      saveBlob(await BalanceSheetService.pdf(s.id ?? ""), `balance-sheet-${s.date}.pdf`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const rows = data?.content ?? []
  const finalised = rows.filter((r) => r.status === "FINALISED")
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={finalised.length < 2} onClick={() => setComparing(true)}>
            <GitCompare className="size-4" /> {t("le.compare")}
          </Button>
          {close && (
            <Button onClick={() => setGenerating(true)}>
              <Plus className="size-4" /> {t("le.sheet.generate")}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pos.date")}</TableHead>
                <TableHead>{t("le.financialYear")}</TableHead>
                <TableHead className="text-right">{t("le.assets")}</TableHead>
                <TableHead className="text-right">{t("le.liabilities")}</TableHead>
                <TableHead className="text-right">{t("le.equity")}</TableHead>
                <TableHead>{t("le.check")}</TableHead>
                <TableHead>{t("crm.status")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                    {t("le.sheet.empty")}
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setViewing(s.id)}>
                        {formatDate(s.date, language)}
                      </button>
                    </TableCell>
                    <TableCell>{s.financialYear}</TableCell>
                    <TableCell className="text-right">{money(s.totalAssets)}</TableCell>
                    <TableCell className="text-right">{money(s.totalLiabilities)}</TableCell>
                    <TableCell className="text-right">{money(s.totalEquity)}</TableCell>
                    <TableCell>
                      <BalancedBadge sheet={s} money={money} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "FINALISED" ? "default" : "outline"}>{t(`le.sheet.${s.status ?? "DRAFT"}` as TranslationKey)}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={t("le.sheet.actionsFor", { date: s.date ?? "" })}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(s.id)}>{t("le.sheet.open")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => download(s)}>
                            <Download className="size-4" /> {t("pos.downloadPdf")}
                          </DropdownMenuItem>
                          {close && s.status === "DRAFT" && (
                            <>
                              <DropdownMenuItem onClick={() => setPending({ action: "regenerate", row: s })}>
                                <RefreshCw className="size-4" /> {t("le.sheet.regenerate")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPending({ action: "finalise", row: s })}>
                                <Lock className="size-4" /> {t("le.sheet.finalise")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: s })}>
                                <Trash2 className="size-4" /> {t("common.delete")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
      </CardContent>

      <Dialog open={generating} onOpenChange={setGenerating}>
        <DialogContent className="sm:max-w-md">{generating && <GenerateForm onClose={() => setGenerating(false)} onSaved={(s) => (reload(), setViewing(s.id))} />}</DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{viewing && <SheetView key={viewing} id={viewing} canEdit={close} onChanged={reload} />}</DialogContent>
      </Dialog>
      <Dialog open={comparing} onOpenChange={setComparing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{comparing && <CompareView sheets={finalised} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`le.confirm.sheet.${pending?.action ?? "delete"}` as TranslationKey, { date: pending?.row.date ?? "" })}
        description={t(`le.confirm.sheet.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={pending?.action === "delete" ? t("common.delete") : t(`le.sheet.${pending?.action ?? "finalise"}` as TranslationKey)}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const call = { finalise: () => BalanceSheetService.finalise(id), regenerate: () => BalanceSheetService.regenerate(id), delete: () => BalanceSheetService.remove(id) }[pending.action]
          if (await attempt(call, t("common.saved"))) reload()
        }}
      />
    </Card>
  )
}

function BalancedBadge({ sheet, money }: { sheet: SheetDto; money: Money }) {
  const t = useT()
  return sheet.balanced ? (
    <Badge variant="secondary">{t("le.balanced")}</Badge>
  ) : (
    <Badge variant="destructive">{t("le.difference", { amount: money(sheet.difference) })}</Badge>
  )
}

function GenerateForm({ onClose, onSaved }: { onClose: () => void; onSaved: (s: SheetDto) => void }) {
  const t = useT()
  const [date, setDate] = React.useState(today())
  const [year, setYear] = React.useState(String(new Date().getFullYear()))
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const yearOk = /^\d{4}$/.test(year)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("le.sheet.generate")}</DialogTitle>
        <DialogDescription>{t("le.sheet.generateHint")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="bs-date" label={t("pos.date")}>
          <Input id="bs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="bs-year" label={t("le.financialYear")}>
          <Input id="bs-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
        <Field id="bs-notes" label={t("le.notes")} className="sm:col-span-2">
          <Textarea id="bs-notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={saving || !date || !yearOk}
          onClick={async () => {
            setSaving(true)
            try {
              const s = await BalanceSheetService.generate({ date, financialYear: Number(year), notes: notes.trim() || undefined })
              toast.success(t("common.saved"))
              onClose()
              onSaved(s)
            } catch (e) {
              toast.error(errorMessage(e))
            } finally {
              setSaving(false)
            }
          }}
        >
          {t("le.sheet.generate")}
        </Button>
      </DialogFooter>
    </>
  )
}

function SheetView({ id, canEdit, onChanged }: { id: string; canEdit: boolean; onChanged: () => void }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [sheet, setSheet] = React.useState<SheetDto>()
  const [notes, setNotes] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    BalanceSheetService.get(id)
      .then((s) => !cancelled && setSheet(s))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id])

  if (!sheet) return <Skeleton className="h-64 w-full" />
  const draft = sheet.status === "DRAFT"
  const current = notes ?? sheet.notes ?? ""
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("le.sheet.title", { date: formatDate(sheet.date, language) })}</DialogTitle>
        <DialogDescription>
          {t("le.financialYear")} {sheet.financialYear} · {t(`le.sheet.${sheet.status ?? "DRAFT"}` as TranslationKey)}
        </DialogDescription>
      </DialogHeader>
      <Alert variant={sheet.balanced ? "default" : "destructive"}>
        <AlertDescription data-testid="sheet-check">
          {t("le.sheet.equation", { assets: money(sheet.totalAssets), liabilities: money(sheet.totalLiabilities), equity: money(sheet.totalEquity) })} —{" "}
          {sheet.balanced ? t("le.balanced") : t("le.difference", { amount: money(sheet.difference) })}
        </AlertDescription>
      </Alert>
      <div className="grid gap-4">
        {(sheet.sections ?? []).map((sec) => (
          <Card key={sec.section}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{t(`le.section.${sec.section}` as TranslationKey)}</CardTitle>
              <span className="font-semibold">{money(sec.total)}</span>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {!sec.groups?.length && <p className="text-muted-foreground">{t("le.noActivity")}</p>}
              {(sec.groups ?? []).map((g) => (
                <div key={g.group} className="grid gap-1">
                  <div className="flex justify-between font-medium">
                    <span>{g.group}</span>
                    <span>{money(g.total)}</span>
                  </div>
                  {(g.lines ?? []).map((l) => (
                    <div key={l.accountId} className="text-muted-foreground flex justify-between pl-4">
                      <span>
                        <span className="font-mono text-xs">{l.accountCode}</span> {l.accountName}
                      </span>
                      <span>{money(l.amount)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Field id="sheet-notes" label={t("le.notes")}>
        <Textarea id="sheet-notes" rows={3} maxLength={2000} readOnly={!draft || !canEdit} value={current} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {draft && canEdit && (
        <DialogFooter>
          <Button
            disabled={notes === undefined || notes === (sheet.notes ?? "")}
            onClick={async () => {
              try {
                setSheet(await BalanceSheetService.notes(id, current.trim()))
                setNotes(undefined)
                toast.success(t("common.saved"))
                onChanged()
              } catch (e) {
                toast.error(errorMessage(e))
              }
            }}
          >
            {t("le.saveNotes")}
          </Button>
        </DialogFooter>
      )}
    </>
  )
}

function CompareView({ sheets }: { sheets: SheetDto[] }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [first, setFirst] = React.useState(sheets[1]?.id ?? "")
  const [second, setSecond] = React.useState(sheets[0]?.id ?? "")
  const key = first && second && first !== second ? `${first}|${second}` : ""
  const [state, setState] = React.useState<{ key: string; data?: CompareDto; error?: string }>()
  React.useEffect(() => {
    if (!key) return
    let cancelled = false
    const [a, b] = key.split("|")
    BalanceSheetService.compare(a, b)
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: Error) => !cancelled && setState({ key, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [key])
  const s = state?.key === key ? state : undefined
  const options = sheets.map((x) => ({ value: x.id ?? "", label: `${formatDate(x.date, language)} (${x.financialYear})` }))
  const totals = s?.data ? ([["le.assets", s.data.totalAssets], ["le.liabilities", s.data.totalLiabilities], ["le.equity", s.data.totalEquity]] as const) : []
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("le.compare")}</DialogTitle>
        <DialogDescription>{t("le.compareHint")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <PlainSelect label={t("le.firstSheet")} value={first} onChange={setFirst} options={options} />
        <PlainSelect label={t("le.secondSheet")} value={second} onChange={setSecond} options={options} />
      </div>
      {!key ? null : !s ? (
        <Skeleton className="h-40 w-full" />
      ) : s.error ? (
        <p className="text-destructive text-sm">{s.error}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("le.account")}</TableHead>
                <TableHead className="text-right">{formatDate(s.data?.first?.date, language)}</TableHead>
                <TableHead className="text-right">{formatDate(s.data?.second?.date, language)}</TableHead>
                <TableHead className="text-right">{t("le.change")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(s.data?.lines ?? []).map((l, i) => (
                <TableRow key={`${l.accountCode}-${i}`}>
                  <TableCell>
                    <span className="text-muted-foreground text-xs">{t(`le.section.${l.section}` as TranslationKey)} · </span>
                    <span className="font-mono text-xs">{l.accountCode}</span> {l.accountName}
                  </TableCell>
                  <TableCell className="text-right">{money(l.first)}</TableCell>
                  <TableCell className="text-right">{money(l.second)}</TableCell>
                  <TableCell className={`text-right ${(l.change ?? 0) < 0 ? "text-destructive" : ""}`}>{money(l.change)}</TableCell>
                </TableRow>
              ))}
              {totals.map(([k, l]) => (
                <TableRow key={k} className="font-semibold">
                  <TableCell>{t(k)}</TableCell>
                  <TableCell className="text-right">{money(l?.first)}</TableCell>
                  <TableCell className="text-right">{money(l?.second)}</TableCell>
                  <TableCell className="text-right">{money(l?.change)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}

/** Year-end close: revenue and expense accounts into retained earnings, next year opened; once per year, cannot be undone. */
function YearEnd() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const close = !!useAuthStore((s) => s.me?.permissions)?.includes("LEDGER_CLOSE")
  const [rows, setRows] = React.useState<CloseDto[]>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const lastYear = new Date().getFullYear() - 1
  const [year, setYear] = React.useState(String(lastYear))
  const [date, setDate] = React.useState(`${lastYear}-12-31`)
  const [confirming, setConfirming] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    YearEndService.list({ size: 50 })
      .then((p) => !cancelled && setRows(p.content ?? []))
      .catch((e: Error) => !cancelled && (toast.error(e.message), setRows([])))
    return () => {
      cancelled = true
    }
  }, [reloadKey])
  const yearOk = /^\d{4}$/.test(year)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("le.yearEnd.history")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("le.financialYear")}</TableHead>
                <TableHead>{t("le.closingDate")}</TableHead>
                <TableHead>{t("le.closingEntry")}</TableHead>
                <TableHead>{t("le.closedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!rows && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {rows?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-16 text-center">
                    {t("le.yearEnd.empty")}
                  </TableCell>
                </TableRow>
              )}
              {rows?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.financialYear}</TableCell>
                  <TableCell>{formatDate(r.closingDate, language)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.entryNumber}</TableCell>
                  <TableCell>{formatDate(r.closedAt, language)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {close && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("le.yearEnd.close")}</CardTitle>
            <CardDescription>{t("le.yearEnd.hint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field id="ye-year" label={t("le.financialYear")}>
              <Input id="ye-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
            </Field>
            <Field id="ye-date" label={t("le.closingDate")}>
              <Input id="ye-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Button variant="destructive" disabled={!yearOk || !date} onClick={() => setConfirming(true)}>
              <Lock className="size-4" /> {t("le.yearEnd.close")}
            </Button>
          </CardContent>
        </Card>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("le.yearEnd.confirm", { year })}
        description={t("le.yearEnd.confirmDesc")}
        confirmLabel={t("le.yearEnd.close")}
        onConfirm={async () => {
          if (await attempt(() => YearEndService.close({ financialYear: Number(year), closingDate: date }), t("common.saved"))) setReloadKey((x) => x + 1)
        }}
      />
    </div>
  )
}
