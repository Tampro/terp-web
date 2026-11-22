"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// POS (manual §10). Spec: commerce-service PosController / PosService (CartForm {customerId?, warehouseId, bankAccountId,
// discount, lines[{itemId, quantity}]}, PreviewDto, OrderRow, OrderDetail, BarcodeForm ≤ 300 labels), PosReportService
// (SalesReport, ProductReport, CustomerReport; period ≤ 366 days, POS_007). Prices and taxes come from the items; stock
// leaves the warehouse (never below zero) and the total is recorded as income in the bank account (POS_003/004).
// Permissions POS_SELL (checkout, barcodes), POS_VIEW (orders), POS_REPORT. Every field optional.

export interface CartForm {
  /** omit = Walk-in Customer */
  customerId?: number | null
  warehouseId: number
  /** required to pay (POS_003), optional for a preview */
  bankAccountId?: number | null
  /** amount off the whole order, not a percentage (POS_005: ≤ subtotal + taxes) */
  discount?: number
  lines: { itemId: number; quantity: number }[]
}

export interface PosLineDto {
  itemId?: string
  itemType?: string
  itemName?: string
  sku?: string | null
  quantity?: number
  unitPrice?: number
  taxName?: string | null
  taxRate?: number | null
  amount?: number
  taxAmount?: number
}
export interface PosTaxDto {
  name?: string
  rate?: number
  amount?: number
}
export interface PreviewDto {
  customerName?: string
  warehouseName?: string
  subtotal?: number
  taxes?: PosTaxDto[]
  taxTotal?: number
  discount?: number
  total?: number
  lines?: PosLineDto[]
}
export interface PosOrderRow {
  id?: string
  /** #POS… */
  number?: string
  receiptNumber?: string
  orderDate?: string
  customerId?: string | null
  customerName?: string
  warehouseId?: string
  warehouseName?: string
  items?: number
  total?: number
  createdDate?: string
}
export interface PosOrderDetail {
  order?: PosOrderRow
  bankAccountId?: string
  bankAccountName?: string
  subtotal?: number
  taxes?: PosTaxDto[]
  taxTotal?: number
  discount?: number
  lines?: PosLineDto[]
}

export interface SalesReport {
  from?: string
  to?: string
  orders?: number
  total?: number
  daily?: { date?: string; orders?: number; total?: number }[]
  monthly?: { month?: string; orders?: number; total?: number }[]
  byWarehouse?: { warehouseId?: string; warehouseName?: string; orders?: number; total?: number }[]
}
export interface ProductReportRow {
  itemId?: string
  itemName?: string
  sku?: string | null
  quantity?: number
  revenue?: number
  orders?: number
}
export interface ProductReport {
  totalQuantity?: number
  top10?: ProductReportRow[]
  all?: ProductReportRow[]
}
export interface CustomerReportRow {
  customerId?: string | null
  customerName?: string
  orders?: number
  spent?: number
  averageOrderValue?: number
  lastOrderDate?: string
}
export interface CustomerReport {
  top10?: CustomerReportRow[]
  all?: CustomerReportRow[]
}

export interface BankAccountOption {
  id?: string
  holderName?: string
  bankName?: string
  accountNumber?: string
  balance?: number
  active?: boolean
}

export const PosService = {
  /** totals as the checkout shows them; nothing written, no stock reserved */
  preview: (body: CartForm) => request<PreviewDto>("/v1/pos/orders/preview", { method: "POST", body }),
  /** pay */
  create: (body: CartForm) => request<PosOrderDetail>("/v1/pos/orders", { method: "POST", body }),
  list: (f: { customerId?: string; warehouseId?: string; from?: string; to?: string; keyword?: string; page?: number; size?: number }) =>
    request<IPage<PosOrderRow>>(withQuery("/v1/pos/orders", { ...f })),
  get: (id: string) => request<PosOrderDetail>(`/v1/pos/orders/${id}`),
  receiptPdf: (id: string) => request<Blob>(`/v1/pos/orders/${id}/pdf`, { as: "blob" }),
  /** at most 300 labels in all (POS_008) */
  barcodesPdf: (body: { warehouseId?: number | null; items: { itemId: number; copies: number }[] }) =>
    request<Blob>("/v1/pos/barcodes/pdf", { method: "POST", body, as: "blob" }),
  salesReport: (from: string, to: string) => request<SalesReport>(withQuery("/v1/pos/reports/sales", { from, to })),
  productReport: (from: string, to: string) => request<ProductReport>(withQuery("/v1/pos/reports/products", { from, to })),
  customerReport: (from: string, to: string) => request<CustomerReport>(withQuery("/v1/pos/reports/customers", { from, to })),
  /** accounting-service; BANK_VIEW */
  bankAccounts: () => request<IPage<BankAccountOption>>(withQuery("/v1/accounting/bank-accounts", { active: true, size: 50 })),
}

/** Saves a downloaded file (blob) under the given name. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Opens a PDF blob in a new tab (the browser's viewer prints it). */
export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
