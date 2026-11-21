"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"

/** Approve / reject with an optional note (OrderDecisionForm.notes ≤ 500). */
export function DecisionDialog({
  decision,
  title,
  description,
  onClose,
  onConfirm,
}: {
  decision: "approve" | "reject" | null
  title: string
  description?: string
  onClose: () => void
  onConfirm: (notes: string) => Promise<void>
}) {
  const t = useT()
  const [notes, setNotes] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [openedFor, setOpenedFor] = React.useState<string | null>(null)
  if (decision !== openedFor) {
    setOpenedFor(decision)
    setNotes("")
  }

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm(notes.trim())
      onClose()
    } catch {
      // onConfirm already showed the error; keep the dialog open so the user can retry
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={decision !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="decision-notes">{t("saas.notes")}</Label>
          <Textarea id="decision-notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant={decision === "reject" ? "destructive" : "default"} disabled={busy} onClick={confirm}>
            {decision === "reject" ? t("saas.reject") : t("saas.approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
