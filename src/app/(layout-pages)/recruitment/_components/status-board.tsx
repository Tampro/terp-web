"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useUrlQuery } from "@/hooks/use-url-query"
import { request, withQuery } from "@/lib/api"
import type { Row } from "@/lib/hrm/hrm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { KanbanBoard } from "../../crm/_components/kanban-board"
import { attempt } from "../../hrm/_components/crud-kit"

/** GET …/kanban: one column per status with its full count and up to 50 cards (candidate / interview / offer KanbanColumn) */
interface BoardColumn {
  status?: string
  count?: number
  cards?: Row[]
}

/**
 * Recruitment status board (manual §17: candidates, interviews, offers). Dropping a card on another column calls `move`
 * (PUT /{id}/status); `check` refuses a move the backend would refuse and names the message to show.
 */
export function StatusBoard({
  path,
  manage,
  reloadKey,
  renderCard,
  check,
  move,
  onChanged,
}: {
  path: string
  manage: boolean
  reloadKey?: number
  renderCard: (row: Row) => React.ReactNode
  check?: (row: Row, to: string) => TranslationKey | undefined
  move: (row: Row, to: string) => Promise<unknown>
  onChanged?: () => void
}) {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("q") ?? ""
  const [draft, setDraft] = React.useState(keyword)
  const [reload, setReload] = React.useState(0)
  const key = JSON.stringify({ path, keyword, reload, reloadKey })
  const [data, setData] = React.useState<{ key: string; columns: BoardColumn[] }>()

  React.useEffect(() => {
    let cancelled = false
    const q = JSON.parse(key) as { path: string; keyword: string }
    request<BoardColumn[]>(withQuery(q.path, { keyword: q.keyword || undefined }))
      .then((c) => !cancelled && setData({ key, columns: c ?? [] }))
      .catch((e: Error) => {
        if (cancelled) return
        toast.error(e.message)
        setData({ key, columns: [] })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  const columns = (data?.columns ?? []).map((c) => {
    const cards = c.cards ?? []
    const count = c.count ?? cards.length
    return { id: String(c.status), name: t(`hr.status.${String(c.status)}` as TranslationKey), extra: count > cards.length ? t("rc.board.of", { n: count }) : undefined, cards }
  })
  const onMove = async (id: string, to: string) => {
    const row = columns.flatMap((c) => c.cards).find((r) => r.id === id)
    if (!row || row.status === to) return
    const refused = check?.(row, to)
    if (refused) {
      toast.error(t(refused))
      return
    }
    // optimistic: the card moves at once; the board reloads afterwards (counts, side effects) and on a refusal
    setData((d) => d && { ...d, columns: d.columns.map((c) => ({ ...c, cards: c.status === to ? [{ ...row, status: to }, ...(c.cards ?? [])] : (c.cards ?? []).filter((r) => r.id !== id) })) })
    const ok = await attempt(() => move(row, to), t("common.saved"))
    setReload((x) => x + 1)
    if (ok) onChanged?.()
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            update({ q: draft.trim() || undefined })
          }}
        >
          <Input className="w-56" aria-label={t("hr.search")} placeholder={t("hr.search")} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button type="submit" variant="outline">
            {t("hr.search")}
          </Button>
          {manage && <span className="text-muted-foreground text-xs">{t("rc.board.hint")}</span>}
        </form>
        {data?.key !== key ? <Skeleton className="h-64 w-full" /> : <KanbanBoard columns={columns} canMove={manage} onMove={(id, to) => void onMove(id, to)} renderCard={renderCard} />}
      </CardContent>
    </Card>
  )
}

/** a board card: title and short lines; a click opens the detail */
export function BoardCard({ title, lines, label, onOpen }: { title: string; lines: React.ReactNode[]; label: string; onOpen?: () => void }) {
  return (
    <button type="button" className="bg-card hover:bg-accent w-full rounded-md border p-2 text-left text-sm shadow-xs" aria-label={label} onClick={onOpen}>
      <div className="font-medium">{title}</div>
      {lines.map((l, i) => (
        <div key={i} className="text-muted-foreground truncate text-xs">
          {l}
        </div>
      ))}
    </button>
  )
}
