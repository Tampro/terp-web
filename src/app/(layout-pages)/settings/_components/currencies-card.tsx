"use client"

import { Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Row } from "@/lib/hrm/hrm.service"
import { useT } from "@/lib/i18n"
import { CurrencyService } from "@/lib/saas/saas.service"

import { CrudSection, type CrudConfig, type FieldDef } from "../../hrm/_components/crud-kit"

// CurrencyForm (SaasCurrencyController): code [A-Z]{3}, name ≤100, symbol ≤10, description ≤500; PUT is a full
// replacement (omitted symbol / description are cleared); defaultCurrency = true moves the default flag here.
const FIELDS: FieldDef[] = [
  { name: "code", label: "cur.code", required: true, max: 3, pattern: /^[A-Z]{3}$/, patternMsg: "cur.codeBad" },
  { name: "name", label: "cur.name", required: true, max: 100 },
  { name: "symbol", label: "cur.symbol", max: 10 },
  // never shown nor sent: remembers whether the row being edited is the default
  { name: "wasDefault", label: "cur.default", type: "switch", hidden: () => true },
  // hidden for the current default: it stays default (SAAS_025); toBody then leaves the field out (see save)
  { name: "defaultCurrency", label: "cur.setDefault", type: "switch", hidden: (v) => v.wasDefault === true },
  { name: "description", label: "cur.description", type: "textarea", max: 500, full: true },
]

/**
 * Currency page (manual §3.7 Currency → default currency): the currencies companies can use, and which one is the
 * platform default. The default can't be deleted (SAAS_024) or un-defaulted (SAAS_025): another one is made default.
 */
export function CurrenciesCard({ onChanged }: { onChanged: () => void }) {
  const t = useT()
  const body = (r: Row, defaultCurrency: boolean) => ({
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    symbol: r.symbol ? String(r.symbol) : undefined,
    description: r.description ? String(r.description) : undefined,
    defaultCurrency,
  })
  const cfg: CrudConfig = {
    id: "currencies",
    load: CurrencyService.list as CrudConfig["load"],
    keyword: true,
    manage: true,
    rowName: (r) => `${r.code ?? ""} · ${r.name ?? ""}`,
    createLabel: "cur.add",
    fields: FIELDS,
    defaults: { defaultCurrency: false },
    // the default stays default on edit (SAAS_025): its switch is hidden and true is sent
    toValues: (r) => ({ ...r, wasDefault: r.defaultCurrency === true }),
    save: (id, b) => {
      // the switch is only missing from the body when it was hidden, i.e. for the current default
      const out = { code: String(b.code ?? ""), name: String(b.name ?? ""), symbol: b.symbol as string | undefined, description: b.description as string | undefined, defaultCurrency: "defaultCurrency" in b ? b.defaultCurrency === true : true }
      return (id ? CurrencyService.update(id, out) : CurrencyService.create(out)).then((x) => {
        onChanged()
        return x
      })
    },
    remove: CurrencyService.remove,
    canDelete: (r) => r.defaultCurrency !== true,
    columns: [
      {
        label: "cur.code",
        render: (r) => (
          <span className="font-mono font-medium">
            {String(r.code ?? "-")}
            {r.defaultCurrency === true && (
              <Badge className="ml-2 font-sans" data-testid="currency-default">
                {t("cur.default")}
              </Badge>
            )}
          </span>
        ),
      },
      { label: "cur.name", path: "name" },
      { label: "cur.symbol", path: "symbol" },
      { label: "cur.description", path: "description" },
    ],
    actions: [
      {
        key: "default",
        label: "cur.makeDefault",
        icon: <Star />,
        when: (r) => r.defaultCurrency !== true,
        confirmDesc: "cur.makeDefaultConfirm",
        run: (r) => CurrencyService.update(String(r.id), body(r, true)).then((x) => {
          onChanged()
          return x
        }),
      },
    ],
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cur.title")}</CardTitle>
        <CardDescription>{t("cur.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <CrudSection config={cfg} />
      </CardContent>
    </Card>
  )
}
