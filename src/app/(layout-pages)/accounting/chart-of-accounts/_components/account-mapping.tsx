"use client"

import * as React from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CoaService, type AccountDto, type MappingDto } from "@/lib/accounting/accounting.service"
import { useT, type TranslationKey } from "@/lib/i18n"

/**
 * System account mapping (accounting-service LedgerController GET / PUT /accounting/account-mapping; COA_VIEW /
 * COA_MANAGE): which ledger account plays each system key in automatic postings (bank, receivable, VAT, revenue,
 * COGS, …). The first read seeds the default VAS TT200 chart. PUT is a full replacement — every key mapped to an
 * active account (else ACC_017) — and applies to postings made after the change.
 */
export function AccountMapping({ manage }: { manage: boolean }) {
  const t = useT()
  const [rows, setRows] = React.useState<MappingDto[]>()
  const [accounts, setAccounts] = React.useState<AccountDto[]>([])
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string>()
  const [saving, setSaving] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([CoaService.mapping(), CoaService.accounts({ active: true, size: 500 })])
      .then(([m, a]) => {
        if (cancelled) return
        setRows(m)
        setAccounts(a.content ?? [])
        setDraft(Object.fromEntries(m.map((r) => [r.key ?? "", r.accountId ?? ""])))
        setError(undefined)
      })
      .catch((e: Error) => !cancelled && (setRows([]), setError(e.message)))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const changed = !!rows?.some((r) => (draft[r.key ?? ""] ?? "") !== (r.accountId ?? ""))
  const incomplete = !!rows?.some((r) => !draft[r.key ?? ""])

  async function save() {
    setSaving(true)
    setError(undefined)
    try {
      await CoaService.saveMapping(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])))
      toast.success(t("common.saved"))
      setReloadKey((x) => x + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t("acc.map.desc")}</p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!rows ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table data-testid="account-mapping">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("acc.map.key")}</TableHead>
                  <TableHead>{t("acc.map.account")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const key = r.key ?? ""
                  const label = t(`acc.map.k.${key}` as TranslationKey)
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div className="font-medium">{label}</div>
                        <div className="text-muted-foreground font-mono text-xs">{key}</div>
                      </TableCell>
                      <TableCell>
                        {manage ? (
                          <Select value={draft[key] ?? ""} onValueChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}>
                            <SelectTrigger className="w-full min-w-64" aria-label={label}>
                              <SelectValue placeholder={t("acc.map.choose")} />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id ?? ""}>
                                  {a.code} · {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{r.accountCode ? `${r.accountCode} · ${r.accountName ?? ""}` : "-"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {manage && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={!changed || incomplete || saving}>
              {t("common.save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
