"use client"

import * as React from "react"
import { Briefcase, Building2, Calculator, FileSignature, Package, TrendingUp, Users } from "lucide-react"

import { LanguageSelect } from "@/components/auth/language-select"
import { usePublicSettings } from "@/hooks/use-public-settings"
import { useT, type TranslationKey } from "@/lib/i18n"
import { CookieBanner } from "@/components/site/cookie-banner"

/**
 * Sign-in pages layout: product overview on the left (large screens), form card on the right,
 * language selector top right, footer text from Brand Settings.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const t = useT()
  const settings = usePublicSettings()
  const brand = settings?.brand?.titleText || "ERP"
  const logo = settings?.brand?.logoLightUrl

  return (
    <div className="bg-muted/40 grid min-h-svh lg:grid-cols-[1.15fr_1fr]">
      <aside className="relative hidden flex-col justify-center overflow-hidden px-12 py-10 lg:flex xl:px-20">
        <div className="bg-primary/10 absolute -top-32 -left-32 size-96 rounded-full blur-3xl" />
        <div className="bg-primary/10 absolute -right-24 -bottom-24 size-80 rounded-full blur-3xl" />
        <div className="relative">
          <h2 className="mb-4 text-3xl leading-tight font-bold xl:text-4xl">
            {t("auth.side.title1")}
            <br />
            {t("auth.side.title2")} <span className="text-primary">{brand}</span>
          </h2>
          <p className="text-muted-foreground mb-10 max-w-lg">{t("auth.side.subtitle")}</p>
          <OverviewCard />
        </div>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={brand} className="h-8 w-auto" />
            ) : (
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
                {brand.charAt(0)}
              </span>
            )}
            <span>{brand}</span>
          </div>
          <LanguageSelect />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="bg-card w-full max-w-md rounded-2xl border p-6 shadow-sm sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
            </div>
            {children}
          </div>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          {settings?.brand?.footerText || `© ${new Date().getFullYear()} ${brand}`}
        </p>
      </main>
      {/* as on the reference sign-in pages: guests get the cookie consent banner here too (manual §3.7 Cookie) */}
      <CookieBanner />
    </div>
  )
}

const MODULES: { key: TranslationKey; icon: React.ElementType; value: string; width: string }[] = [
  { key: "auth.side.hrm", icon: Users, value: "124", width: "w-full" },
  { key: "auth.side.accounting", icon: Calculator, value: "842", width: "w-3/4" },
  { key: "auth.side.pos", icon: Package, value: "315", width: "w-1/2" },
  { key: "auth.side.recruitment", icon: Briefcase, value: "48", width: "w-1/4" },
]

/** Illustrative figures only (marketing panel), not live data. */
function OverviewCard() {
  const t = useT()
  return (
    <div className="bg-card max-w-xl rounded-xl border p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="bg-primary/15 flex size-8 items-center justify-center rounded-lg">
          <Building2 className="text-primary size-4" />
        </span>
        <h3 className="font-semibold">{t("auth.side.overview")}</h3>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {MODULES.map(({ key, icon: Icon, value, width }) => (
          <div key={key} className="bg-background rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Icon className="text-primary size-4" />
              <span className="truncate text-xs font-semibold">{t(key)}</span>
            </div>
            <div className="text-primary mb-2 text-xl font-bold">{value}</div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className={`bg-primary h-full rounded-full ${width}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background flex items-center gap-3 rounded-xl border p-3">
          <span className="bg-primary/15 flex size-10 shrink-0 items-center justify-center rounded-full">
            <FileSignature className="text-primary size-5" />
          </span>
          <div>
            <div className="text-xs font-semibold">{t("auth.side.contracts")}</div>
            <div className="text-muted-foreground text-xl font-bold">
              12 <span className="text-xs font-normal">{t("auth.side.thisWeek")}</span>
            </div>
          </div>
        </div>
        <div className="bg-background rounded-xl border p-3">
          <div className="text-xs font-semibold">{t("auth.side.revenue")}</div>
          <div className="text-primary text-xl font-bold">$35,200</div>
          <div className="text-primary flex items-center gap-1 text-xs font-semibold">
            <TrendingUp className="size-3.5" /> +12% <span className="text-muted-foreground font-normal">{t("auth.side.vsLastMonth")}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
