"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Sales & revenue (manual §6). Spec: commerce-service SalesControllers (/sales/quotations, /proposals, /invoices),
// SalesReturnController (/sales/returns), SalesDtos; lookups from accounting-service (/accounting/customers) and
// inventory-service (/inventory/items, /warehouses). Swagger shows the return's LineForm for both line forms: the
// document line is {itemId, quantity, unitPrice, discountPct} (SalesDtos.LineForm). Every field optional.

export type EDocumentKind = "QUOTATION" | "PROPOSAL" | "INVOICE"
export type EDocumentStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "POSTED" | "PARTIAL" | "PAID"
export type EInvoiceType = "PRODUCT" | "SERVICE"
export type EReturnStatus = "DRAFT" | "APPROVED" | "COMPLETED"

export interface DocumentRow {
  id?: string
  kind?: EDocumentKind
  /** SP-/QT-/SI-YYYY-MM-NNN */
  number?: string
  invoiceType?: EInvoiceType | null
  customerId?: string
  customerName?: string | null
  warehouseId?: string | null
  docDate?: string
  dueDate?: string
  subtotal?: number
  discount?: number
  tax?: number
  total?: number
  balance?: number
  status?: EDocumentStatus
  /** invoice posted or partly paid past its due date */
  overdue?: boolean
  /** quotation or proposal still SENT past its due date */
  expired?: boolean
  versionNo?: number | null
  versionOfId?: string | null
  convertedInvoiceId?: string | null
  convertedFromId?: string | null
}

export interface LineDto {
  id?: string
  invoiceLineId?: string | null
  itemId?: string
  itemType?: string
  itemName?: string
  sku?: string | null
  quantity?: number
  unitPrice?: number
  discountPct?: number
  taxRate?: number
  discount?: number
  taxAmount?: number
  lineTotal?: number
  reason?: string | null
}

export interface DocumentDetail {
  document?: DocumentRow
  paymentTerms?: string | null
  notes?: string | null
  lines?: LineDto[]
}

export interface DocumentLineForm {
  itemId: number
  /** omit = 1; a service-wise invoice takes 1 only */
  quantity?: number
  /** omit = the item's sale price */
  unitPrice?: number
  discountPct?: number
}

export interface DocumentForm {
  customerId: number
  warehouseId?: number | null
  /** invoices only */
  invoiceType?: EInvoiceType
  docDate: string
  dueDate: string
  paymentTerms?: string | null
  notes?: string | null
  lines: DocumentLineForm[]
}

export interface DocumentFilter {
  customerId?: string
  warehouseId?: string
  status?: string
  overdue?: boolean
  from?: string
  to?: string
  keyword?: string
  page?: number
  size?: number
}

export type StatusCounts = Partial<Record<EDocumentStatus, number>>

export interface ReturnRow {
  id?: string
  /** SR-YYYY-MM-NNN */
  number?: string
  invoiceId?: string
  customerId?: string
  customerName?: string | null
  warehouseId?: string | null
  returnDate?: string
  total?: number
  items?: number
  status?: EReturnStatus
}

export interface ReturnDetail {
  ret?: ReturnRow
  reason?: string | null
  notes?: string | null
  subtotal?: number
  discount?: number
  tax?: number
  lines?: LineDto[]
}

export interface ReturnableLine {
  invoiceLineId?: string
  itemId?: string
  itemName?: string
  sku?: string | null
  invoiced?: number
  /** not yet returned */
  returnable?: number
  unitPrice?: number
  discountPct?: number
  taxRate?: number
}

export interface ReturnForm {
  invoiceId: number
  /** omit = the invoice's warehouse; none for a service-wise invoice */
  warehouseId?: number | null
  returnDate: string
  reason?: string | null
  notes?: string | null
  lines: { invoiceLineId: number; quantity: number; reason?: string | null }[]
}

export interface CustomerOption {
  id?: string
  customerCode?: string
  companyName?: string
  paymentTerms?: string | null
}

export interface ItemOption {
  id?: string
  type?: "PRODUCT" | "SERVICE" | "PART"
  name?: string
  sku?: string | null
  taxName?: string | null
  /** % ; null = no tax */
  taxRate?: number | null
  salePrice?: number | null
  /** default unit price of purchase invoice lines */
  purchasePrice?: number | null
}

export interface WarehouseOption {
  id?: string
  name?: string
  city?: string | null
  active?: boolean
}

const BASE: Record<EDocumentKind, string> = {
  QUOTATION: "/v1/sales/quotations",
  PROPOSAL: "/v1/sales/proposals",
  INVOICE: "/v1/sales/invoices",
}

/** One service per document kind; quotations, proposals and invoices share the same DTOs. */
export function salesDocuments(kind: EDocumentKind) {
  const base = BASE[kind]
  const action = (id: string, name: string) => request<DocumentDetail>(`${base}/${id}/${name}`, { method: "POST" })
  return {
    list: (f: DocumentFilter) => request<IPage<DocumentRow>>(withQuery(base, { ...f })),
    counts: (f: Omit<DocumentFilter, "status" | "page" | "size">) =>
      request<StatusCounts>(withQuery(`${base}/status-counts`, { ...f })),
    get: (id: string) => request<DocumentDetail>(`${base}/${id}`),
    create: (body: DocumentForm) => request<DocumentDetail>(base, { method: "POST", body }),
    /** full replacement of the header and lines; drafts only */
    update: (id: string, body: DocumentForm) => request<DocumentDetail>(`${base}/${id}`, { method: "PUT", body }),
    remove: (id: string) => request<void>(`${base}/${id}`, { method: "DELETE" }),
    send: (id: string) => action(id, "send"),
    accept: (id: string) => action(id, "accept"),
    reject: (id: string) => action(id, "reject"),
    /** accepted quotation/proposal → draft invoice, once */
    convert: (id: string) => action(id, "convert"),
    /** quotations: copy into a new draft */
    duplicate: (id: string) => action(id, "duplicate"),
    /** quotations: new draft version of a sent, accepted or rejected one */
    newVersion: (id: string) => action(id, "versions"),
    /** invoices: DRAFT → POSTED (stock leaves the warehouse) */
    post: (id: string) => action(id, "post"),
  }
}

export const SalesReturnService = {
  list: (f: DocumentFilter & { invoiceId?: string }) =>
    request<IPage<ReturnRow>>(withQuery("/v1/sales/returns", { ...f })),
  get: (id: string) => request<ReturnDetail>(`/v1/sales/returns/${id}`),
  returnable: (invoiceId: string) => request<ReturnableLine[]>(withQuery("/v1/sales/returns/returnable", { invoiceId })),
  create: (body: ReturnForm) => request<ReturnDetail>("/v1/sales/returns", { method: "POST", body }),
  update: (id: string, body: ReturnForm) => request<ReturnDetail>(`/v1/sales/returns/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/sales/returns/${id}`, { method: "DELETE" }),
  approve: (id: string) => request<ReturnDetail>(`/v1/sales/returns/${id}/approve`, { method: "POST" }),
  complete: (id: string) => request<ReturnDetail>(`/v1/sales/returns/${id}/complete`, { method: "POST" }),
}

export const SalesLookupService = {
  customers: (keyword?: string) =>
    request<IPage<CustomerOption>>(withQuery("/v1/accounting/customers", { keyword, size: 50 })),
  items: (keyword?: string, type?: string) =>
    request<IPage<ItemOption>>(withQuery("/v1/inventory/items", { keyword, type, size: 50 })),
  warehouses: () => request<IPage<WarehouseOption>>(withQuery("/v1/inventory/warehouses", { active: true, size: 100 })),
}
