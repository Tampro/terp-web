"use client"

import * as React from "react"

import { useT } from "@/lib/i18n"

export interface KanbanColumn<C> {
  id: string
  name: string
  /** under the name, e.g. the deal total */
  extra?: string
  cards: C[]
}

/**
 * Lead / deal board (manual §7.2, §7.3): drag a card onto another card (takes its place) or onto a column (end).
 * Native HTML5 drag and drop, no library. Positions are 1-based like MoveForm.position.
 */
export function KanbanBoard<C extends { id?: string }>({
  columns,
  canMove,
  renderCard,
  onMove,
}: {
  columns: KanbanColumn<C>[]
  canMove: boolean
  renderCard: (card: C) => React.ReactNode
  onMove: (cardId: string, stageId: string, position?: number) => void
}) {
  const t = useT()
  const [over, setOver] = React.useState<string>()
  const drop = (e: React.DragEvent, stageId: string, position?: number) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(undefined)
    const id = e.dataTransfer.getData("text/plain")
    if (id) onMove(id, stageId, position)
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <section
          key={col.id}
          aria-label={col.name}
          className={`bg-muted/40 flex w-72 shrink-0 flex-col gap-2 rounded-lg border p-2 ${over === col.id ? "ring-primary ring-2" : ""}`}
          onDragOver={(e) => {
            if (!canMove) return
            e.preventDefault()
            setOver(col.id)
          }}
          onDragLeave={() => setOver((o) => (o === col.id ? undefined : o))}
          onDrop={(e) => drop(e, col.id)}
        >
          <header className="flex items-baseline justify-between px-1">
            <h3 className="text-sm font-medium">{col.name}</h3>
            <span className="text-muted-foreground text-xs">
              {col.cards.length}
              {col.extra ? ` · ${col.extra}` : ""}
            </span>
          </header>
          {col.cards.length === 0 && <p className="text-muted-foreground px-1 py-4 text-center text-xs">{t("crm.board.empty")}</p>}
          {col.cards.map((card, i) => (
            <div
              key={card.id}
              draggable={canMove}
              data-card-id={card.id}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", card.id ?? "")
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragOver={(e) => canMove && e.preventDefault()}
              onDrop={(e) => drop(e, col.id, i + 1)}
              className={canMove ? "cursor-grab active:cursor-grabbing" : undefined}
            >
              {renderCard(card)}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
