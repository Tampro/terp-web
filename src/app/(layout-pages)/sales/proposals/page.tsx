"use client"

import * as React from "react"

import { DocumentList } from "../_components/document-list"

/** §6.1 Proposals (commerce-service /v1/sales/proposals). */
export default function Page() {
  return (
    <React.Suspense>
      <DocumentList kind="PROPOSAL" />
    </React.Suspense>
  )
}
