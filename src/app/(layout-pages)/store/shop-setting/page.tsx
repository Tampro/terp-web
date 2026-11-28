"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuthStore } from "@/lib/auth/auth.store"
import { getShopSettingSchema, type TShopSettingSchema } from "@/lib/store/store.schema"
import { ShopSettingService } from "@/lib/store/store.service"
import { useT } from "@/lib/i18n"

/** The company's public shop: its address (slug, unique across companies) and whether customers can reach it. */
export default function ShopSettingPage() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("STORE_MANAGE")
  const [values, setValues] = React.useState<TShopSettingSchema>({ slug: "", enabled: false })
  const form = useForm<TShopSettingSchema>({ resolver: zodResolver(getShopSettingSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState

  React.useEffect(() => {
    let cancelled = false
    ShopSettingService.get()
      .then((s) => !cancelled && setValues({ slug: s?.slug ?? "", enabled: !!s?.enabled }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(v: TShopSettingSchema) {
    try {
      const saved = await ShopSettingService.save({ slug: v.slug.trim(), enabled: v.enabled })
      setValues({ slug: saved?.slug ?? v.slug, enabled: !!saved?.enabled })
      toast.success(t("common.saved"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e)) // STO_014 used, STO_015 reserved
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.store.shopSetting")} description={t("store.shop.subtitle")} />
      <Card className="max-w-xl">
        <CardContent>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="shop-slug">{t("store.shop.slug")}</Label>
              <Input id="shop-slug" readOnly={!manage} placeholder="homeplus-express" {...form.register("slug")} />
              <p className="text-muted-foreground text-xs">{t("store.shop.slugHint")}</p>
              <FieldError message={errors.slug?.message} />
            </div>
            <Controller
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={field.value} disabled={!manage} onCheckedChange={field.onChange} aria-label={t("store.shop.enabled")} />
                  {t("store.shop.enabled")}
                </label>
              )}
            />
            {manage && (
              <div>
                <Button type="submit" disabled={isSubmitting}>
                  {t("common.save")}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
