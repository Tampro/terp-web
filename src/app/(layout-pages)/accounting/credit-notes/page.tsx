"use client"

import * as React from "react"

import { NotePage } from "../_components/note-page"

/** §12 credit-notes. */
export default function Page() {
  return (
    <React.Suspense>
      <NotePage kind="credit-notes" />
    </React.Suspense>
  )
}
