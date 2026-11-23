"use client"

import { RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { EJournalStatus } from "@/lib/sales/sales.service"

export const JOURNAL_STATUSES: EJournalStatus[] = ["PENDING", "POSTED", "FAILED"]
const ALL = "__all"

/**
 * Accounting journal of a posted purchase invoice / completed return (commerce EJournalStatus): written asynchronously
 * by accounting-service after posting — PENDING, then POSTED or FAILED (journalErrorCode, e.g. ACC_070 closed year,
 * ACC_017 unmapped account). Shown only when it needs attention (pending or failed); null = nothing to journal.
 */
export function JournalBadge({ status, errorCode }: { status?: EJournalStatus | null; errorCode?: string | null }) {
  const t = useT()
  if (status !== "PENDING" && status !== "FAILED") return null
  return (
    <Badge
      variant={status === "FAILED" ? "destructive" : "outline"}
      title={errorCode ?? undefined}
      data-testid="journal-badge"
    >
      {t(`journal.${status}` as TranslationKey)}
      {status === "FAILED" && errorCode ? ` · ${errorCode}` : ""}
    </Badge>
  )
}

/** Purchase invoice list filter (?journalStatus=). */
export function JournalFilter({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className="w-44" aria-label={t("journal.filter")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("journal.all")}</SelectItem>
        {JOURNAL_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`journal.${s}` as TranslationKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Row action "Retry journal" (…/{id}/journal/retry, *_POST): only for a FAILED journal; FAILED → PENDING, no stock move. */
export function RetryJournalItem({ onRetry }: { onRetry: () => void }) {
  const t = useT()
  return (
    <DropdownMenuItem onClick={onRetry}>
      <RotateCcw className="size-4" /> {t("journal.retry")}
    </DropdownMenuItem>
  )
}
