"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, Trash2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldError, PasswordInput } from "@/components/auth/password-input"
import { getInitials } from "@/components/user-menu-content"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getChangePasswordSchema,
  getProfileSchema,
  type TChangePasswordSchema,
  type TProfileSchema,
} from "@/lib/auth/auth.schema"
import { AuthService } from "@/lib/auth/auth.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { tokenStore } from "@/lib/api"
import { useT } from "@/lib/i18n"

export default function ProfilePage() {
  const t = useT()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("profile.subtitle")}</p>
      </div>
      <PersonalInfoCard />
      <ChangePasswordCard />
    </div>
  )
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif"]

/** PUT /me/profile is a full replacement: name, email, mobile and avatar are always sent together. */
function PersonalInfoCard() {
  const t = useT()
  const { profile, setProfile } = useAuthStore()
  const superAdmin = !!profile?.superAdmin // mobile and avatar are not for the super admin (ProfileForm)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = React.useState<{ id: string | null; url: string | null }>({
    id: profile?.avatarFileId ?? null,
    url: profile?.avatarUrl ?? null,
  })
  const [uploading, setUploading] = React.useState(false)

  const form = useForm<TProfileSchema>({
    resolver: zodResolver(getProfileSchema(t)),
    mode: "all",
    values: { fullName: profile?.fullName ?? "", email: profile?.email ?? "", mobile: profile?.mobile ?? "" },
  })
  const { errors, isSubmitting, isDirty } = form.formState
  const avatarChanged = avatar.id !== (profile?.avatarFileId ?? null)

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) return void toast.error(t("profile.photoType"))
    if (file.size > MAX_AVATAR_BYTES) return void toast.error(t("profile.photoTooLarge"))
    setUploading(true)
    try {
      const uploaded = await AuthService.uploadImage(file)
      if (uploaded?.id) setAvatar({ id: uploaded.id, url: uploaded.viewUrl ?? URL.createObjectURL(file) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit(v: TProfileSchema) {
    try {
      const saved = await AuthService.updateProfile({
        fullName: v.fullName,
        email: v.email,
        mobile: superAdmin ? null : v.mobile || null,
        avatarFileId: superAdmin || !avatar.id ? null : Number(avatar.id),
      })
      const next = saved ?? (await AuthService.getProfile())
      setProfile(next)
      setAvatar({ id: next?.avatarFileId ?? null, url: next?.avatarUrl ?? null })
      toast.success(t("profile.saved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const fullName = useWatch({ control: form.control, name: "fullName" })
  const name = fullName || profile?.username || ""

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle>{t("profile.info")}</CardTitle>
          <CardDescription>{t("profile.infoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pb-6">
          {!superAdmin && (
            <div className="flex items-center gap-4">
              <Avatar className="size-20 rounded-full ring-2 ring-border">
                <AvatarImage src={avatar.url ?? undefined} alt={name} />
                <AvatarFallback className="text-lg">{getInitials(name)}</AvatarFallback>
              </Avatar>
              <div className="grid gap-2">
                <Label>{t("profile.photo")}</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Camera className="size-4" /> {t("profile.upload")}
                  </Button>
                  {avatar.id && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar({ id: null, url: null })}>
                      <Trash2 className="size-4" /> {t("profile.remove")}
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">{t("profile.photoHint")}</p>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.gif" hidden onChange={onPickFile} />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="username">{t("profile.username")}</Label>
              <Input id="username" value={profile?.username ?? ""} disabled className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fullName">{t("common.name")}</Label>
              <Input id="fullName" className="h-10" {...form.register("fullName")} />
              <FieldError message={errors.fullName?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" className="h-10" {...form.register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            {!superAdmin && (
              <div className="grid gap-1.5">
                <Label htmlFor="mobile">{t("profile.mobile")}</Label>
                <Input id="mobile" className="h-10" placeholder="+84 90 000 0000" {...form.register("mobile")} />
                <FieldError message={errors.mobile?.message} />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
          <Button type="submit" disabled={isSubmitting || uploading || (!isDirty && !avatarChanged)}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

/** PUT /me/password ends every session, this one included → back to /login. */
function ChangePasswordCard() {
  const t = useT()
  const router = useRouter()
  const form = useForm<TChangePasswordSchema>({
    resolver: zodResolver(getChangePasswordSchema(t)),
    mode: "all",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TChangePasswordSchema) {
    try {
      await AuthService.changePassword(v)
      tokenStore.clear()
      useAuthStore.setState({ me: undefined, profile: undefined, status: "anonymous" })
      toast.success(t("profile.passwordChanged"))
      router.replace("/login")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle>{t("profile.password")}</CardTitle>
          <CardDescription>{t("profile.passwordDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pb-6 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
            <PasswordInput id="currentPassword" withIcon={false} autoComplete="current-password" {...form.register("currentPassword")} />
            <FieldError message={errors.currentPassword?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
            <PasswordInput id="newPassword" withIcon={false} autoComplete="new-password" {...form.register("newPassword")} />
            <FieldError message={errors.newPassword?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirmPassword">{t("common.confirmPassword")}</Label>
            <PasswordInput id="confirmPassword" withIcon={false} autoComplete="new-password" {...form.register("confirmPassword")} />
            <FieldError message={errors.confirmPassword?.message} />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t pt-6">
          <Button type="button" variant="ghost" onClick={() => form.reset()}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
