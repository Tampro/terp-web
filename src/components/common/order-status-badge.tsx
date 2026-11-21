"use client"

import { Badge } from "@/components/ui/badge"
import { useT, type TranslationKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const STYLE: Record<string, { key: TranslationKey; className: string }> = {
  PENDING: { key: "saas.status.PENDING", className: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  APPROVED: { key: "saas.status.APPROVED", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  REJECTED: { key: "saas.status.REJECTED", className: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300" },
  CANCELLED: { key: "saas.status.CANCELLED", className: "text-muted-foreground" },
}

/** PENDING / APPROVED / REJECTED / CANCELLED (orders and plan requests); unknown or missing → "-". */
export function OrderStatusBadge({ status }: { status?: string | null }) {
  const t = useT()
  const s = status ? STYLE[status] : undefined
  if (!s) return <span>-</span>
  return (
    <Badge variant="outline" className={cn(s.className)}>
      {t(s.key)}
    </Badge>
  )
}
