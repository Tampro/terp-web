"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { PageHeader } from "@/components/common/page-header"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useT, type TranslationKey } from "@/lib/i18n"

import { BrandTab, CookieTab, CurrencyTab, EmailTab, PaymentTab, RecaptchaTab, SeoTab, StorageTab, SystemTab } from "./_components/settings-tabs"

const TABS: { value: string; label: TranslationKey; Comp: React.ComponentType }[] = [
  { value: "brand", label: "settings.brand", Comp: BrandTab },
  { value: "system", label: "settings.systemTab", Comp: SystemTab },
  { value: "currency", label: "settings.currency", Comp: CurrencyTab },
  { value: "email", label: "settings.email", Comp: EmailTab },
  { value: "seo", label: "settings.seo", Comp: SeoTab },
  { value: "cookie", label: "settings.cookie", Comp: CookieTab },
  { value: "recaptcha", label: "settings.recaptcha", Comp: RecaptchaTab },
  { value: "storage", label: "settings.storage", Comp: StorageTab },
  { value: "payment", label: "settings.payment", Comp: PaymentTab },
]

export default function SettingsPage() {
  return (
    <RequireSuperAdmin>
      <React.Suspense>
        <PlatformSettings />
      </React.Suspense>
    </RequireSuperAdmin>
  )
}

/** §3.7 Platform settings — /settings/admin/*. The tab lives in ?tab= so a reload stays on it. */
function PlatformSettings() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const tabParam = useSearchParams().get("tab")
  const tab = TABS.some((x) => x.value === tabParam) ? tabParam! : "brand"

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`)}>
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((x) => (
              <TabsTrigger key={x.value} value={x.value}>
                {t(x.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map(({ value, Comp }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {tab === value && <Comp />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
