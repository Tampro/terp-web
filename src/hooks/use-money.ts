"use client"

import { usePublicSettings } from "@/hooks/use-public-settings"
import { formatMoney } from "@/lib/format"

/** `money(amount)` in the platform currency (GET /settings/public → currency). */
export function useMoney() {
  const currency = usePublicSettings()?.currency
  return (amount: number | null | undefined) =>
    formatMoney(amount, { ...currency?.format, symbol: currency?.defaultCurrencySymbol })
}
