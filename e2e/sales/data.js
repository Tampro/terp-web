// @ts-check
// Fake sales data shaped like commerce-service DocumentRow / DocumentDetail / ReturnRow / ReturnableLine and the
// accounting / inventory lookups. Obviously fake values only.

export const SALES_ALL = ["SALES_VIEW", "SALES_MANAGE", "SALES_POST", "QUOTATION_VIEW", "QUOTATION_MANAGE"]

export const CUSTOMERS = [
  { id: "5", customerCode: "E2E-C1", companyName: "E2E Công ty TNHH Ánh Dương" },
  { id: "6", customerCode: "E2E-C2", companyName: "E2E O'Brien & Sons" },
]
export const ITEMS = [
  { id: "12", type: "PRODUCT", name: "E2E Bàn phím", sku: "KB-01", taxName: "VAT", taxRate: 10, salePrice: 100000 },
  { id: "13", type: "SERVICE", name: "E2E Lắp đặt", sku: "SV-01", taxName: null, taxRate: null, salePrice: 50000 },
]
export const WAREHOUSES = [{ id: "2", name: "E2E Kho Hà Nội", active: true }]

/** @param {Partial<Record<string, unknown>>} over */
export const doc = (over) => ({
  id: "100",
  kind: "PROPOSAL",
  number: "SP-2026-11-001",
  customerId: "5",
  customerName: "E2E Công ty TNHH Ánh Dương",
  warehouseId: "2",
  docDate: "2026-11-20",
  dueDate: "2026-12-20",
  subtotal: 200000,
  discount: 0,
  tax: 20000,
  total: 220000,
  balance: 220000,
  status: "DRAFT",
  overdue: false,
  expired: false,
  versionNo: 1,
  convertedInvoiceId: null,
  ...over,
})

export const PROPOSALS = [
  doc({}),
  doc({ id: "101", number: "SP-2026-11-002", status: "SENT", expired: true }),
  doc({ id: "102", number: "SP-2026-11-003", status: "ACCEPTED" }),
  doc({ id: "103", number: "SP-2026-11-004", status: "ACCEPTED", convertedInvoiceId: "300" }),
]
export const PROPOSAL_COUNTS = { DRAFT: 1, SENT: 1, ACCEPTED: 2, REJECTED: 0 }

export const INVOICES = [
  doc({ id: "300", kind: "INVOICE", number: "SI-2026-11-001", invoiceType: "PRODUCT" }),
  doc({ id: "301", kind: "INVOICE", number: "SI-2026-11-002", invoiceType: "PRODUCT", status: "POSTED", overdue: true, balance: 220000 }),
]
export const INVOICE_COUNTS = { DRAFT: 1, POSTED: 1, PARTIAL: 0, PAID: 0 }

export const QUOTATIONS = [
  doc({ id: "200", kind: "QUOTATION", number: "QT-2026-11-001", status: "SENT", versionNo: 2 }),
  doc({ id: "201", kind: "QUOTATION", number: "QT-2026-11-002", status: "REJECTED" }),
]
export const QUOTATION_COUNTS = { DRAFT: 0, SENT: 1, ACCEPTED: 0, REJECTED: 1 }

export const DETAIL = {
  document: PROPOSALS[0],
  paymentTerms: "Net 30",
  notes: "E2E giao tại văn phòng",
  lines: [
    {
      id: "1",
      itemId: "12",
      itemType: "PRODUCT",
      itemName: "E2E Bàn phím",
      sku: "KB-01",
      quantity: 2,
      unitPrice: 100000,
      discountPct: 0,
      taxRate: 10,
      discount: 0,
      taxAmount: 20000,
      lineTotal: 220000,
    },
  ],
}

export const RETURNS = [
  { id: "50", number: "SR-2026-11-001", invoiceId: "301", customerName: "E2E O'Brien & Sons", warehouseId: "2", returnDate: "2026-11-21", total: 110000, items: 1, status: "DRAFT" },
  { id: "51", number: "SR-2026-11-002", invoiceId: "301", customerName: "E2E O'Brien & Sons", warehouseId: "2", returnDate: "2026-11-21", total: 110000, items: 1, status: "APPROVED" },
]
export const RETURNABLE = [
  { invoiceLineId: "900", itemId: "12", itemName: "E2E Bàn phím", sku: "KB-01", invoiced: 2, returnable: 2, unitPrice: 100000, discountPct: 0, taxRate: 10 },
]
