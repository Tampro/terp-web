"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BankService, CoaService, type AccountDto, type BankAccountDto } from "@/lib/accounting/accounting.service"
import { useT, type TranslationKey } from "@/lib/i18n"

export { attempt, errorMessage, Field, today } from "../../projects/_components/project-kit"

const VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "outline",
  PENDING: "outline",
  APPROVED: "secondary",
  PARTIAL: "secondary",
  POSTED: "default",
  CLEARED: "default",
  COMPLETED: "default",
  APPLIED: "default",
  RECONCILED: "default",
  CANCELLED: "destructive",
}
/** Status of vouchers, payments, notes, transfers and bank transactions. */
export function AccStatusBadge({ status }: { status?: string | null }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={VARIANT[status] ?? "outline"}>{t(`acc.status.${status}` as TranslationKey)}</Badge>
}

/** Bank accounts and ledger accounts used by most accounting forms. */
export function useAccLookups() {
  const [state, setState] = React.useState<{ banks: BankAccountDto[]; accounts: AccountDto[]; loaded: boolean }>({ banks: [], accounts: [], loaded: false })
  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      BankService.accounts({ size: 100 }).then((p) => p.content ?? []).catch(() => []),
      CoaService.accounts({ active: true, size: 500 }).then((p) => p.content ?? []).catch(() => []),
    ]).then(([banks, accounts]) => !cancelled && setState({ banks, accounts, loaded: true }))
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export const bankLabel = (b?: BankAccountDto) => (b ? `${b.bankName ?? ""} · ${b.accountNumber ?? ""}` : "-")
export const accountLabel = (a?: AccountDto) => (a ? `${a.code} · ${a.name}` : "-")

/** Plain select with an optional "none" entry; value "" = none. */
export function PlainSelect({
  id,
  label,
  value,
  onChange,
  options,
  none,
  className = "w-full",
  disabled,
}: {
  id?: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  none?: string
  className?: string
  disabled?: boolean
}) {
  const t = useT()
  const NONE = "__none"
  return (
    <Select value={value || (none ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} className={className} aria-label={label}>
        <SelectValue placeholder={t("sales.choose")} />
      </SelectTrigger>
      <SelectContent>
        {none && <SelectItem value={NONE}>{none}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
