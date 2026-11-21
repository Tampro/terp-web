"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

/** "Showing x–y of total" + prev/next. `page` is zero-based like the backend. */
export function Pager({
  page,
  size,
  total,
  totalPages,
  onPage,
}: {
  page: number
  size: number
  total: number
  totalPages: number
  onPage: (page: number) => void
}) {
  const t = useT()
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min(total, (page + 1) * size)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{t("common.showing", { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("common.prevPage")}
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2">
          {totalPages === 0 ? 0 : page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("common.nextPage")}
          disabled={page + 1 >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
