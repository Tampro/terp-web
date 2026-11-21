"use client"

import * as React from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMoney } from "@/hooks/use-money"
import { usePublicSettings } from "@/hooks/use-public-settings"
import { useT } from "@/lib/i18n"
import { MediaService } from "@/lib/media/media.service"
import {
  SubscriptionService,
  type EBillingCycle,
  type EPaymentMethod,
  type OrderDto,
  type PlanDto,
  type QuoteDto,
} from "@/lib/saas/saas.service"
import { cn } from "@/lib/utils"

const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png"]
const RECEIPT_MAX = 5 * 1024 * 1024

/**
 * §4.2 Subscribe: price (quote with optional coupon) → payment method → order.
 * Bank transfer: shows the bank details + transfer content and takes the receipt (PDF/JPG/PNG ≤5 MB, uploaded to the
 * media library, then PUT /orders/{id}/receipt). Stripe: redirects to the Checkout URL. "Request" sends a plan request
 * for the super admin instead of paying online.
 */
export function SubscribeDialog({
  plan,
  cycle,
  onClose,
  onDone,
}: {
  plan?: PlanDto
  cycle: EBillingCycle
  onClose: () => void
  onDone: () => void
}) {
  const t = useT()
  const money = useMoney()
  const payments = usePublicSettings()?.payments
  const methods: EPaymentMethod[] = [
    ...(payments?.bankTransfer !== false ? (["BANK_TRANSFER"] as const) : []),
    ...(payments?.stripe ? (["STRIPE"] as const) : []),
  ]
  const [method, setMethod] = React.useState<EPaymentMethod>("BANK_TRANSFER")
  const [coupon, setCoupon] = React.useState("")
  const [quote, setQuote] = React.useState<QuoteDto>()
  const [quoteError, setQuoteError] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  const [order, setOrder] = React.useState<OrderDto>()
  const [receiptName, setReceiptName] = React.useState<string>()
  const [openedFor, setOpenedFor] = React.useState<string>()
  const fileInput = React.useRef<HTMLInputElement>(null)

  const planId = Number(plan?.id)
  const key = plan ? `${plan.id}-${cycle}` : undefined
  if (key !== openedFor) {
    // New plan/cycle opened: reset the dialog (state derived from props, no effect).
    setOpenedFor(key)
    setCoupon("")
    setQuote(undefined)
    setQuoteError(undefined)
    setOrder(undefined)
    setReceiptName(undefined)
    setMethod(methods[0] ?? "BANK_TRANSFER")
  }

  const loadQuote = React.useCallback(
    async (couponCode?: string) => {
      if (!plan?.id) return
      setQuoteError(undefined)
      try {
        setQuote(await SubscriptionService.quote({ planId, billingCycle: cycle, couponCode: couponCode || undefined, paymentMethod: method }))
      } catch (e) {
        // Keep the last valid price: the order sends quote.couponCode, so a refused coupon is never ordered.
        setQuoteError(e instanceof Error ? e.message : String(e))
      }
    },
    [plan?.id, planId, cycle, method]
  )

  // First price (no coupon) when a plan/cycle opens; coupon changes go through "Apply".
  React.useEffect(() => {
    if (!plan?.id) return
    let cancelled = false
    SubscriptionService.quote({ planId: Number(plan.id), billingCycle: cycle, paymentMethod: "BANK_TRANSFER" })
      .then((q) => !cancelled && setQuote(q))
      .catch((e: Error) => !cancelled && setQuoteError(e.message))
    return () => {
      cancelled = true
    }
  }, [plan?.id, cycle])

  async function placeOrder() {
    setBusy(true)
    try {
      const o = await SubscriptionService.order({
        planId,
        billingCycle: cycle,
        couponCode: quote?.couponCode || undefined,
        paymentMethod: method,
      })
      if (method === "STRIPE" && o?.id) {
        const checkout = await SubscriptionService.stripeCheckout(o.id)
        // Only follow an https link from the backend (Stripe Checkout).
        if (checkout?.url?.startsWith("https://")) return window.location.assign(checkout.url)
        throw new Error(t("subscription.stripeNoUrl"))
      }
      setOrder(o)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function requestPlan() {
    setBusy(true)
    try {
      await SubscriptionService.requestPlan({ planId, billingCycle: cycle })
      toast.success(t("subscription.requestSent"))
      onDone()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function uploadReceipt(file?: File) {
    if (!file || !order?.id) return
    if (!RECEIPT_TYPES.includes(file.type)) return void toast.error(t("subscription.receiptType"))
    if (file.size > RECEIPT_MAX) return void toast.error(t("subscription.receiptTooLarge"))
    setBusy(true)
    try {
      const [uploaded] = (await MediaService.upload([file])) ?? []
      if (!uploaded?.id) throw new Error(t("subscription.receiptFailed"))
      await SubscriptionService.attachReceipt(order.id, Number(uploaded.id))
      setReceiptName(file.name)
      toast.success(t("subscription.receiptAttached"))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const bank = order?.bankTransfer

  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("subscription.subscribeTo", { name: plan?.name ?? "" })}</DialogTitle>
          <DialogDescription>{cycle === "YEARLY" ? t("plans.yearly") : t("plans.monthly")}</DialogDescription>
        </DialogHeader>

        {order ? (
          <div className="grid gap-3 text-sm">
            <Alert>
              <AlertDescription>{t("subscription.orderCreated", { number: order.orderNumber ?? "-" })}</AlertDescription>
            </Alert>
            {order.paymentMethod === "BANK_TRANSFER" && (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">{t("subscription.bankName")}</dt>
                  <dd>{bank?.bankName ?? "-"}</dd>
                  <dt className="text-muted-foreground">{t("subscription.accountNumber")}</dt>
                  <dd className="font-mono">{bank?.accountNumber ?? "-"}</dd>
                  <dt className="text-muted-foreground">{t("subscription.accountName")}</dt>
                  <dd>{bank?.accountName ?? "-"}</dd>
                  <dt className="text-muted-foreground">{t("subscription.amount")}</dt>
                  <dd className="font-semibold">{money(order.finalPrice)}</dd>
                  <dt className="text-muted-foreground">{t("subscription.transferContent")}</dt>
                  <dd className="font-mono" data-testid="transfer-content">{bank?.transferContent ?? "-"}</dd>
                </dl>
                <p className="text-muted-foreground">{t("subscription.receiptHint")}</p>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  accept=".pdf,.jpg,.jpeg,.png"
                  data-testid="receipt-input"
                  onChange={(e) => {
                    void uploadReceipt(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
                <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
                  <Upload className="size-4" /> {receiptName ? t("subscription.replaceReceipt") : t("subscription.uploadReceipt")}
                </Button>
                {receiptName && <p className="text-emerald-600">{t("subscription.receiptName", { name: receiptName })}</p>}
              </>
            )}
            <DialogFooter>
              <Button onClick={onClose}>{t("common.done")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("subscription.price")}</dt>
              <dd data-testid="quote-original">{money(quote?.originalPrice)}</dd>
              <dt className="text-muted-foreground">{t("subscription.discount")}</dt>
              <dd data-testid="quote-discount">{quote?.discountAmount ? `-${money(quote.discountAmount)}` : "-"}</dd>
              <dt className="text-muted-foreground font-medium">{t("subscription.total")}</dt>
              <dd className="font-semibold" data-testid="quote-final">
                {money(quote?.finalPrice)}
              </dd>
            </dl>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon">{t("subscription.coupon")}</Label>
              <div className="flex gap-2">
                <Input id="coupon" value={coupon} maxLength={50} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
                <Button type="button" variant="secondary" disabled={!coupon.trim()} onClick={() => loadQuote(coupon.trim())}>
                  {t("subscription.apply")}
                </Button>
              </div>
              {quoteError && <p className="text-destructive text-xs">{quoteError}</p>}
              {quote?.couponCode && !quoteError && (
                <p className="text-xs text-emerald-600">{t("subscription.couponApplied", { code: quote.couponCode })}</p>
              )}
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("subscription.paymentMethod")}</legend>
              {methods.length === 0 && <p className="text-muted-foreground text-sm">{t("subscription.noPayment")}</p>}
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={cn("rounded-lg border p-3 text-left text-sm", method === m && "border-primary ring-primary/30 ring-2")}
                  >
                    {t(m === "STRIPE" ? "subscription.stripe" : "subscription.bankTransfer")}
                  </button>
                ))}
              </div>
            </fieldset>
            <DialogFooter className="flex-wrap gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={requestPlan}>
                {t("subscription.requestInstead")}
              </Button>
              <Button type="button" disabled={busy || !quote || methods.length === 0} onClick={placeOrder}>
                {method === "STRIPE" ? t("subscription.payStripe") : t("subscription.placeOrder")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
