"use client"

import * as React from "react"
import { Eraser, PenLine, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/components/user-menu-content"
import { ContractService, type ESignerType, type SignatureDto } from "@/lib/crm/crm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

const SIDES: ESignerType[] = ["COMPANY", "CLIENT"]

/**
 * §7 contract signatures (crm-service ContractSignatureController). One hand-drawn signature per side; either side may
 * sign first; both signed → ACTIVE. Only a PENDING contract can be signed (CTR_017); after the first signature the
 * contract can't be edited or deleted (CTR_018). The client signs on the client portal. A drawn signature is an
 * electronic acceptance record, not a qualified digital signature.
 */
export function ContractSignatures({
  contractId,
  signatures,
  loading,
  canSign,
  onSigned,
}: {
  contractId: string
  signatures?: SignatureDto[]
  loading: boolean
  /** CRM_CONTRACT_MANAGE(_OWN) and the contract is PENDING */
  canSign: boolean
  onSigned: () => void
}) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [signing, setSigning] = React.useState(false)
  const bySide = (s: ESignerType) => signatures?.find((x) => x.signerType === s)

  return (
    <Card data-testid="contract-signatures">
      <CardHeader>
        <CardTitle className="text-base">{t("crm.sign.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {SIDES.map((side) => {
              const s = bySide(side)
              return (
                <div key={side} className="grid content-start gap-2 rounded-md border p-3" data-testid={`signature-${side}`}>
                  <p className="text-muted-foreground text-xs">{t(`crm.sign.side.${side}`)}</p>
                  {s ? (
                    <>
                      <SignatureImage contractId={contractId} side={side} />
                      <div className="text-sm">
                        <p className="font-medium">{s.signerName ?? "-"}</p>
                        <p className="text-muted-foreground text-xs">{formatDate(s.signedAt, language, true)}</p>
                        {s.signerEmail && <p className="text-muted-foreground text-xs">{s.signerEmail}</p>}
                      </div>
                      {s.contentMatches === false && (
                        <p className="text-destructive flex items-center gap-1 text-xs" role="note">
                          <ShieldAlert className="size-3.5" /> {t("crm.sign.changed")}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm">{t("crm.sign.notSigned")}</p>
                      {side === "COMPANY" && canSign && (
                        <div>
                          <Button size="sm" onClick={() => setSigning(true)}>
                            <PenLine className="size-4" /> {t("crm.sign.sign")}
                          </Button>
                        </div>
                      )}
                      {side === "CLIENT" && <p className="text-muted-foreground text-xs">{t("crm.sign.clientHint")}</p>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="text-muted-foreground text-xs">{t("crm.sign.legal")}</p>
      </CardContent>
      <SignDialog
        open={signing}
        contractId={contractId}
        onClose={() => setSigning(false)}
        onSigned={() => {
          setSigning(false)
          onSigned()
        }}
      />
    </Card>
  )
}

/** The PNG of one side, read with the token (an <img src> cannot send it) and shown from a blob URL. */
function SignatureImage({ contractId, side }: { contractId: string; side: ESignerType }) {
  const t = useT()
  const [url, setUrl] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    let made: string | undefined
    ContractService.signatureImage(contractId, side)
      .then((b) => {
        if (cancelled) return
        made = URL.createObjectURL(b)
        setUrl(made)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [contractId, side])
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- blob URL of the signature PNG
    <img src={url} alt={t("crm.sign.imageAlt", { side: t(`crm.sign.side.${side}`) })} className="bg-background h-24 w-full rounded border object-contain" />
  ) : (
    <Skeleton className="h-24 w-full" />
  )
}

const W = 600
const H = 200

function SignDialog({ open, contractId, onClose, onSigned }: { open: boolean; contractId: string; onClose: () => void; onSigned: () => void }) {
  const t = useT()
  const user = useCurrentUser()
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef(false)
  const [drawn, setDrawn] = React.useState(false)
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string>()

  const ctx = () => canvas.current?.getContext("2d") ?? null
  const clear = () => {
    const c = ctx()
    if (c && canvas.current) c.clearRect(0, 0, canvas.current.width, canvas.current.height)
    setDrawn(false)
  }
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ctx()
    if (!c) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = point(e)
    c.lineWidth = 2.5
    c.lineCap = "round"
    c.lineJoin = "round"
    c.strokeStyle = "#111827"
    c.beginPath()
    c.moveTo(p.x, p.y)
    c.lineTo(p.x + 0.01, p.y)
    c.stroke()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ctx()
    if (!drawing.current || !c) return
    const p = point(e)
    c.lineTo(p.x, p.y)
    c.stroke()
    setDrawn(true)
  }
  const up = () => {
    drawing.current = false
  }

  async function submit() {
    if (!canvas.current || !drawn) return
    setSaving(true)
    setError(undefined)
    try {
      // PNG data URL of a 600 x 200 canvas: far under the 200 KB / 2000 x 1000 px limits (CTR_014 / CTR_015)
      await ContractService.sign(contractId, { signatureDataUrl: canvas.current.toDataURL("image/png"), signerName: name.trim() || undefined })
      toast.success(t("crm.sign.done"))
      onSigned()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
        else {
          setName(user.name ?? "")
          setError(undefined)
          setDrawn(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={() => (setName(user.name ?? ""), setDrawn(false), setError(undefined))}>
        <DialogHeader>
          <DialogTitle>{t("crm.sign.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("crm.sign.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sign-name">{t("crm.sign.name")}</Label>
            <Input id="sign-name" maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("crm.sign.pad")}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <Eraser className="size-4" /> {t("crm.sign.clear")}
              </Button>
            </div>
            <canvas
              ref={canvas}
              width={W}
              height={H}
              aria-label={t("crm.sign.pad")}
              data-testid="signature-pad"
              className="w-full touch-none rounded-md border bg-white"
              style={{ aspectRatio: `${W} / ${H}` }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!drawn || saving}>
            {t("crm.sign.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
