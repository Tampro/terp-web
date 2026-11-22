"use client"

import { Badge } from "@/components/ui/badge"
import type { EDocumentStatus, EReturnStatus } from "@/lib/sales/sales.service"
import { useT, type TranslationKey } from "@/lib/i18n"

const VARIANT: Record<EDocumentStatus | EReturnStatus, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "outline",
  SENT: "secondary",
  ACCEPTED: "default",
  REJECTED: "destructive",
  POSTED: "secondary",
  PARTIAL: "secondary",
  PAID: "default",
  APPROVED: "secondary",
  COMPLETED: "default",
}

export function SalesStatusBadge({ status }: { status?: EDocumentStatus | EReturnStatus }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={VARIANT[status]}>{t(`sales.status.${status}` as TranslationKey)}</Badge>
}
