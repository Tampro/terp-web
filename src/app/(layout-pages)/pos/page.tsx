"use client"

import * as React from "react"
import Link from "next/link"
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { CatalogService, ItemService, TransferService, type CategoryDto, type ItemDto } from "@/lib/inventory/inventory.service"
import { PosService, type BankAccountOption, type CartForm, type PosOrderDetail, type PreviewDto } from "@/lib/pos/pos.service"
import { toNumber } from "@/lib/sales/sales.schema"
import { SalesLookupService, type CustomerOption, type WarehouseOption } from "@/lib/sales/sales.service"

import { MediaThumb } from "../inventory/_components/media-thumb"
import { ReceiptView, Totals, type ReceiptData } from "./_components/receipt-view"

const WALK_IN = "__walkin"
const ALL = "ALL"
type Cart = { itemId: string; quantity: number }[]

/**
 * §10 POS checkout: product grid by category with search and stock of the chosen warehouse; customer (Walk-in by
 * default), warehouse, bank account; cart +/−/remove; totals from POST /pos/orders/preview (prices and taxes from the
 * items). Checkout → payment screen → pay (POST /pos/orders) → receipt with PDF / print.
 */
export default function PosPage() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [items, setItems] = React.useState<ItemDto[]>()
  const [categories, setCategories] = React.useState<CategoryDto[]>([])
  const [customers, setCustomers] = React.useState<CustomerOption[]>([])
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([])
  const [banks, setBanks] = React.useState<BankAccountOption[]>([])
  const [category, setCategory] = React.useState(ALL)
  const [search, setSearch] = React.useState("")
  const [customerId, setCustomerId] = React.useState(WALK_IN)
  const [warehouseId, setWarehouseId] = React.useState("")
  const [bankAccountId, setBankAccountId] = React.useState("")
  const [discount, setDiscount] = React.useState("")
  const [cart, setCart] = React.useState<Cart>([])
  const [stock, setStock] = React.useState<{ warehouseId: string; byItem: Record<string, number> }>()
  const [preview, setPreview] = React.useState<{ key: string; data?: PreviewDto; error?: string }>()
  const [paying, setPaying] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [receipt, setReceipt] = React.useState<PosOrderDetail>()

  React.useEffect(() => {
    let cancelled = false
    const safe = <T,>(p: Promise<T>, empty: T) => p.catch((e: Error) => (toast.error(e.message), empty))
    Promise.all([
      safe(ItemService.list({ size: 100 }).then((p) => p.content ?? []), []),
      safe(CatalogService.categories.list(), []),
      safe(SalesLookupService.customers().then((p) => p.content ?? []), []),
      safe(SalesLookupService.warehouses().then((p) => p.content ?? []), []),
      safe(PosService.bankAccounts().then((p) => p.content ?? []), []),
    ]).then(([i, c, cu, w, b]) => {
      if (cancelled) return
      setItems(i)
      setCategories(c)
      setCustomers(cu)
      setWarehouses(w)
      setBanks(b)
      setWarehouseId((x) => x || w[0]?.id || "")
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!warehouseId) return
    let cancelled = false
    TransferService.stock(warehouseId)
      .then((rows) => !cancelled && setStock({ warehouseId, byItem: Object.fromEntries((rows ?? []).map((r) => [r.itemId ?? "", r.quantity ?? 0])) }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [warehouseId])

  const discountValue = discount.trim() === "" ? 0 : toNumber(discount)
  const body = React.useMemo<CartForm | undefined>(
    () =>
      warehouseId && cart.length > 0 && discountValue >= 0
        ? {
            customerId: customerId === WALK_IN ? null : Number(customerId),
            warehouseId: Number(warehouseId),
            bankAccountId: bankAccountId ? Number(bankAccountId) : null,
            discount: discountValue,
            lines: cart.map((l) => ({ itemId: Number(l.itemId), quantity: l.quantity })),
          }
        : undefined,
    [warehouseId, cart, customerId, bankAccountId, discountValue]
  )
  const bodyKey = body ? JSON.stringify(body) : ""

  // totals come from the backend (item prices and taxes); debounced while the cart changes
  React.useEffect(() => {
    if (!body) return
    let cancelled = false
    const timer = setTimeout(() => {
      PosService.preview(body)
        .then((data) => !cancelled && setPreview({ key: bodyKey, data }))
        .catch((e: Error) => !cancelled && setPreview({ key: bodyKey, error: e.message }))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [body, bodyKey])

  const stockOf = (id?: string) => (stock?.warehouseId === warehouseId ? (stock.byItem[id ?? ""] ?? 0) : undefined)
  const stocked = (i?: ItemDto) => i?.type !== "SERVICE"
  const itemById = (id: string) => items?.find((i) => i.id === id)
  const inCart = (id: string) => cart.find((l) => l.itemId === id)?.quantity ?? 0
  const canAdd = (i: ItemDto) => !stocked(i) || (stockOf(i.id) ?? 0) > inCart(i.id ?? "")

  function add(i: ItemDto) {
    if (!i.id) return
    if (!canAdd(i)) return toast.error(t("pos.noMoreStock", { name: i.name ?? "" }))
    setCart((c) => (c.some((l) => l.itemId === i.id) ? c.map((l) => (l.itemId === i.id ? { ...l, quantity: l.quantity + 1 } : l)) : [...c, { itemId: i.id!, quantity: 1 }]))
  }
  const change = (id: string, d: number) =>
    setCart((c) => c.map((l) => (l.itemId === id ? { ...l, quantity: l.quantity + d } : l)).filter((l) => l.quantity > 0))

  async function pay() {
    if (!body) return
    setBusy(true)
    try {
      const order = await PosService.create(body)
      setPaying(false)
      setReceipt(order)
      setCart([])
      setDiscount("")
      // stock changed in that warehouse
      setStock(undefined)
      TransferService.stock(warehouseId).then((rows) =>
        setStock({ warehouseId, byItem: Object.fromEntries((rows ?? []).map((r) => [r.itemId ?? "", r.quantity ?? 0])) })
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const q = search.trim().toLowerCase()
  const shown = (items ?? []).filter(
    (i) => (category === ALL || i.categoryId === category) && (!q || i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
  )
  const current = preview?.key === bodyKey ? preview : undefined
  const totals = current?.data
  const receiptData = (o: PosOrderDetail): ReceiptData => ({
    id: o.order?.id,
    number: o.order?.number,
    receiptNumber: o.order?.receiptNumber,
    date: o.order?.orderDate,
    customerName: o.order?.customerName,
    warehouseName: o.order?.warehouseName,
    bankAccountName: o.bankAccountName,
    lines: o.lines,
    subtotal: o.subtotal,
    taxes: o.taxes,
    discount: o.discount,
    total: o.order?.total,
  })

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.pos.checkout")} description={t("pos.subtitle")}>
        <Button variant="outline" asChild>
          <Link href="/pos/orders">{t("menu.pos.orders")}</Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="min-w-0">
          <CardContent className="flex flex-col gap-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("pos.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
            </div>
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="flex-wrap">
                <TabsTrigger value={ALL}>{t("companies.tabAll")}</TabsTrigger>
                {categories.map((c) => (
                  <TabsTrigger key={c.id} value={c.id ?? ""}>
                    {c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {!items ? (
              <Skeleton className="h-64 w-full" />
            ) : shown.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">{t("pos.noProducts")}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {shown.map((i) => {
                  const s = stockOf(i.id)
                  const out = stocked(i) && s !== undefined && s <= 0
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        disabled={out}
                        onClick={() => add(i)}
                        aria-label={t("pos.addToCart", { name: i.name ?? "" })}
                        className="hover:border-primary flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <MediaThumb fileId={i.mainImageId} alt={i.name ?? ""} className="aspect-square h-auto w-full" />
                        <div className="line-clamp-2 text-sm font-medium">{i.name}</div>
                        <div className="text-muted-foreground font-mono text-xs">{i.sku}</div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">{money(i.salePrice)}</span>
                          <span className={`text-xs ${out ? "text-destructive" : "text-muted-foreground"}`}>
                            {stocked(i) ? (s === undefined ? "…" : t("pos.stock", { n: formatNumber(s, language, 2) })) : t("sales.itemType.SERVICE")}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4" /> {t("pos.cart")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pos-customer">{t("sales.customer")}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger id="pos-customer" className="w-full" aria-label={t("sales.customer")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WALK_IN}>{t("pos.walkIn")}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id ?? ""}>
                        {c.companyName ?? c.customerCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pos-warehouse">{t("sales.warehouse")}</Label>
                <Select
                  value={warehouseId}
                  onValueChange={(v) => {
                    setWarehouseId(v)
                    setCart([]) // stock differs per warehouse
                  }}
                >
                  <SelectTrigger id="pos-warehouse" className="w-full" aria-label={t("sales.warehouse")}>
                    <SelectValue placeholder={t("sales.choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id ?? ""}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {cart.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{t("pos.emptyCart")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {cart.map((l) => {
                  const i = itemById(l.itemId)
                  const line = totals?.lines?.find((x) => x.itemId === l.itemId)
                  return (
                    <li key={l.itemId} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{i?.name}</div>
                        <div className="text-muted-foreground text-xs">{money(line?.amount ?? (i?.salePrice ?? 0) * l.quantity)}</div>
                      </div>
                      <Button variant="outline" size="icon" className="size-7" aria-label={t("pos.decrease", { name: i?.name ?? "" })} onClick={() => change(l.itemId, -1)}>
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center" aria-label={t("pos.quantityOf", { name: i?.name ?? "" })}>
                        {l.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={!i || !canAdd(i)}
                        aria-label={t("pos.increase", { name: i?.name ?? "" })}
                        onClick={() => i && add(i)}
                      >
                        <Plus className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" aria-label={t("pos.remove", { name: i?.name ?? "" })} onClick={() => change(l.itemId, -l.quantity)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="pos-discount">{t("pos.discount")}</Label>
              <Input id="pos-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              {!(discountValue >= 0) && <p className="text-destructive text-xs">{t("inventory.v.amount")}</p>}
            </div>
            {current?.error && (
              <Alert variant="destructive">
                <AlertDescription>{current.error}</AlertDescription>
              </Alert>
            )}
            {cart.length > 0 && (totals ? <Totals subtotal={totals.subtotal} taxes={totals.taxes} discount={totals.discount} total={totals.total} /> : !current?.error && <Skeleton className="h-20 w-full" />)}
            <Button size="lg" disabled={!totals || !!current?.error} onClick={() => setPaying(true)}>
              {t("pos.checkout")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={paying} onOpenChange={(o) => !o && !busy && setPaying(false)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("pos.payment")}</DialogTitle>
            <DialogDescription>{t("pos.paymentDesc")}</DialogDescription>
          </DialogHeader>
          {totals && (
            <ReceiptView
              data={{
                date: new Date().toLocaleDateString("en-CA"),
                customerName: totals.customerName,
                warehouseName: totals.warehouseName,
                lines: totals.lines,
                subtotal: totals.subtotal,
                taxes: totals.taxes,
                discount: totals.discount,
                total: totals.total,
              }}
            />
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pos-bank">{t("pos.bankAccount")}</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger id="pos-bank" className="w-full" aria-label={t("pos.bankAccount")}>
                <SelectValue placeholder={t("sales.choose")} />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id ?? ""}>
                    {b.bankName} · {b.holderName} ({b.accountNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{banks.length === 0 ? t("pos.noBankAccounts") : t("pos.bankHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPaying(false)}>
              {t("common.cancel")}
            </Button>
            {/* POS_003: a bank account must be selected before payment */}
            <Button disabled={busy || !bankAccountId} onClick={pay}>
              {t("pos.pay", { amount: money(totals?.total) })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(undefined)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("pos.paid", { number: receipt?.order?.receiptNumber ?? "" })}</DialogTitle>
            <DialogDescription>{receipt?.order?.number}</DialogDescription>
          </DialogHeader>
          {receipt && <ReceiptView data={receiptData(receipt)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
