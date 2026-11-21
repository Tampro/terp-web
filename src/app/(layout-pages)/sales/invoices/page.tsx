"use client"

import * as React from "react"

import { DocumentList } from "../_components/document-list"

/** §6.2 Sales invoices (commerce-service /v1/sales/invoices). */
export default function Page() {
  return (
    <React.Suspense>
      <DocumentList kind="INVOICE" />
    </React.Suspense>
  )
}
