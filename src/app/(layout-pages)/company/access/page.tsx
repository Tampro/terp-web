"use client"

import * as React from "react"
import { KeyRound, Lock, Pencil, ShieldCheck, Unlock } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { AccessService, type PermissionDto, type RoleDto } from "@/lib/company/company.service"
import type { Row } from "@/lib/hrm/hrm.service"
import { useLanguageStore, useT } from "@/lib/i18n"

import { attempt, CrudSection, Field, TabbedPage, useAuthStore, type CrudConfig } from "../../hrm/_components/crud-kit"

export default function AccessPage() {
  return (
    <React.Suspense>
      <Access />
    </React.Suspense>
  )
}

/** §19 users (name, email, password, roles, login status), roles (permission matrix by module), login history. */
function Access() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const perms = useAuthStore((s) => s.me?.permissions) ?? []
  const myId = useAuthStore((s) => s.me?.userId)
  const [roles, setRoles] = React.useState<RoleDto[]>([])
  const [rolesKey, setRolesKey] = React.useState(0)
  const [editingRole, setEditingRole] = React.useState<{ role?: RoleDto } | null>(null)
  React.useEffect(() => {
    let cancelled = false
    AccessService.roles()
      .then((r) => !cancelled && setRoles(r ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [rolesKey])
  const roleOptions = roles.map((r) => ({ value: String(r.id), label: String(r.name ?? r.code) }))
  const roleIdsOf = (codes: unknown) => ((codes as string[] | undefined) ?? []).map((c) => roles.find((r) => r.code === c)?.id).filter(Boolean) as string[]
  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code
  const self = (r: Row) => r.id === myId

  const users: CrudConfig = {
    id: "users",
    load: AccessService.users as CrudConfig["load"],
    keyword: true,
    columns: [
      { label: "co.username", path: "username", kind: "mono" },
      { label: "hr.f.fullName", path: "fullName" },
      { label: "hr.f.email", path: "email" },
      {
        label: "co.roles",
        render: (r) => (
          <div className="flex flex-wrap gap-1">
            {((r.roles as string[] | undefined) ?? []).map((c) => (
              <Badge key={c} variant="outline">
                {roleName(c)}
              </Badge>
            ))}
          </div>
        ),
      },
      { label: "co.loginStatus", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.fullName || r.username || ""),
    createLabel: "co.user.create",
    fields: [
      { name: "username", label: "co.username", required: true, max: 100, min: 3, pattern: /^[a-zA-Z0-9._@+-]{3,}$/, patternMsg: "co.v.username" },
      { name: "email", label: "hr.f.email", type: "email", required: true, max: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
      { name: "fullName", label: "hr.f.fullName", required: true, max: 255 },
      { name: "password", label: "co.passwordOptional", type: "password", max: 128, check: (v) => (v.password && String(v.password).length < 8 ? "hr.v.password" : undefined) },
      { name: "roleIds", label: "co.roles", type: "multi", required: true, options: roleOptions },
    ],
    save: (_id, b) => AccessService.createUser(b as never),
    canEdit: () => false,
    remove: AccessService.removeUser,
    canDelete: (r) => perms.includes("IAM_USER_UPDATE") && !self(r),
    actions: [
      {
        key: "profile",
        label: "co.editProfile",
        icon: <Pencil className="size-4" />,
        when: () => perms.includes("IAM_USER_UPDATE"),
        fields: [
          { name: "fullName", label: "hr.f.fullName", required: true, max: 200 },
          { name: "email", label: "hr.f.email", type: "email", required: true, max: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
        ],
        initial: (r) => ({ fullName: r.fullName, email: r.email }),
        run: (r, b) => AccessService.updateUser(r.id ?? "", b as never),
      },
      {
        key: "roles",
        label: "co.changeRoles",
        icon: <ShieldCheck className="size-4" />,
        when: (r) => perms.includes("IAM_USER_UPDATE") && !self(r),
        fields: [{ name: "roleIds", label: "co.roles", type: "multi", required: true, options: roleOptions }],
        initial: (r) => ({ roleIds: roleIdsOf(r.roles) }),
        run: (r, b) => AccessService.userRoles(r.id ?? "", b.roleIds as number[]),
      },
      {
        key: "password",
        label: "co.resetPassword",
        icon: <KeyRound className="size-4" />,
        when: () => perms.includes("IAM_USER_UPDATE"),
        confirmDesc: "co.resetPasswordDesc",
        fields: [{ name: "newPassword", label: "co.newPassword", type: "password", required: true, max: 128, check: (v) => (String(v.newPassword ?? "").length < 8 ? "hr.v.password" : undefined) }],
        run: (r, b) => AccessService.userPassword(r.id ?? "", String(b.newPassword)),
      },
      { key: "lock", label: "co.lock", icon: <Lock className="size-4" />, when: (r) => perms.includes("IAM_USER_UPDATE") && r.status === "ACTIVE" && !self(r), confirmDesc: "co.lockDesc", destructive: true, run: (r) => AccessService.userStatus(r.id ?? "", "LOCKED") },
      { key: "unlock", label: "co.unlock", icon: <Unlock className="size-4" />, when: (r) => perms.includes("IAM_USER_UPDATE") && r.status === "LOCKED", run: (r) => AccessService.userStatus(r.id ?? "", "ACTIVE") },
    ],
    manage: perms.includes("IAM_USER_CREATE") || perms.includes("IAM_USER_UPDATE"),
  }
  const rolesCfg: CrudConfig = {
    id: `roles-${rolesKey}`,
    load: () => AccessService.roles() as never,
    onRowClick: (r) => setEditingRole({ role: r as RoleDto }),
    columns: [
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.code", path: "code", kind: "mono" },
      { label: "hr.f.description", path: "description" },
      { label: "co.permissions", render: (r) => String(((r.permissions as string[] | undefined) ?? []).length) },
      { label: "hr.f.system", path: "systemRole", kind: "bool" },
    ],
    rowName: (r) => String(r.name ?? ""),
    remove: async (id) => {
      await AccessService.removeRole(id)
      setRolesKey((x) => x + 1)
    },
    canDelete: (r) => perms.includes("IAM_ROLE_DELETE") && !r.systemRole,
    manage: true,
    toolbar: perms.includes("IAM_ROLE_CREATE") ? <Button onClick={() => setEditingRole({})}>{t("co.role.create")}</Button> : undefined,
  }
  const logins: CrudConfig = {
    id: "logins",
    load: AccessService.logins as CrudConfig["load"],
    keyword: true,
    columns: [
      { label: "co.username", path: "username" },
      { label: "co.loginAt", render: (r) => new Date(String(r.loginAt ?? "")).toLocaleString(language) },
      { label: "co.ip", path: "ipAddress", kind: "mono" },
      { label: "co.browser", render: (r) => [r.browser, r.os].filter(Boolean).join(" · ") || "-" },
    ],
    rowName: (r) => `${String(r.username ?? "")} ${String(r.loginAt ?? "")}`,
    remove: AccessService.removeLogin,
    manage: perms.includes("IAM_USER_UPDATE"),
  }
  return (
    <>
      <TabbedPage
        title={t("menu.co.access")}
        description={t("co.access.subtitle")}
        tabs={[
          { key: "users", label: "co.users", content: () => <CrudSection config={users} />, visible: perms.includes("IAM_USER_VIEW") },
          { key: "roles", label: "co.roles", content: () => <CrudSection config={rolesCfg} />, visible: perms.includes("IAM_ROLE_VIEW") },
          { key: "logins", label: "co.loginHistory", content: () => <CrudSection config={logins} />, visible: perms.includes("IAM_USER_VIEW") },
        ]}
      />
      <Dialog open={!!editingRole} onOpenChange={(o) => !o && setEditingRole(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          {editingRole && (
            <RoleEditor
              key={editingRole.role?.id ?? "new"}
              role={editingRole.role}
              canSave={editingRole.role ? perms.includes("IAM_ROLE_UPDATE") && !editingRole.role.systemRole : perms.includes("IAM_ROLE_CREATE")}
              onClose={() => setEditingRole(null)}
              onSaved={() => setRolesKey((x) => x + 1)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Role: code (fixed after create), name, description and the permission matrix grouped by module (select a whole module at once). */
function RoleEditor({ role, canSave, onClose, onSaved }: { role?: RoleDto; canSave: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [all, setAll] = React.useState<PermissionDto[]>()
  const [code, setCode] = React.useState(role?.code ?? "")
  const [name, setName] = React.useState(role?.name ?? "")
  const [description, setDescription] = React.useState(role?.description ?? "")
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set(role?.permissions ?? []))
  const [filter, setFilter] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    AccessService.permissions()
      .then((p) => !cancelled && setAll(p ?? []))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [])
  const groups = React.useMemo(() => {
    const m = new Map<string, PermissionDto[]>()
    for (const p of all ?? []) {
      if (filter && !`${p.module} ${p.code} ${p.description}`.toLowerCase().includes(filter.toLowerCase())) continue
      m.set(p.module ?? "", [...(m.get(p.module ?? "") ?? []), p])
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [all, filter])
  const codeOk = /^[A-Z][A-Z0-9_]{0,49}$/.test(code)
  const valid = codeOk && !!name.trim() && picked.size > 0
  const toggle = (codes: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s)
      for (const c of codes) {
        if (on) n.add(c)
        else n.delete(c)
      }
      return n
    })
  return (
    <>
      <DialogHeader>
        <DialogTitle>{role ? role.name : t("co.role.create")}</DialogTitle>
        <DialogDescription>{role?.systemRole ? t("co.role.systemHint") : t("co.role.hint")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="role-code" label={t("hr.f.code")} error={code && !codeOk ? t("co.v.roleCode") : undefined}>
          <Input id="role-code" disabled={!!role} maxLength={50} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </Field>
        <Field id="role-name" label={t("hr.f.name")}>
          <Input id="role-name" disabled={!canSave} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="role-desc" label={t("hr.f.description")} className="sm:col-span-2">
          <Textarea id="role-desc" rows={2} disabled={!canSave} maxLength={255} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium" data-testid="perm-count">
          {t("co.permissionsPicked", { n: picked.size })}
        </span>
        <Input className="w-56" aria-label={t("co.filterPermissions")} placeholder={t("co.filterPermissions")} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {!all ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map(([module, list]) => {
            const codes = list.map((p) => p.code ?? "")
            const on = codes.filter((c) => picked.has(c)).length
            return (
              <fieldset key={module} className="rounded-md border p-2" disabled={!canSave}>
                <legend className="px-1">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={on === codes.length ? true : on ? "indeterminate" : false} onCheckedChange={(c) => toggle(codes, c === true)} aria-label={t("co.wholeModule", { module })} />
                    {module}
                  </label>
                </legend>
                <div className="grid gap-1">
                  {list.map((p) => (
                    <label key={p.code} className="flex items-start gap-2 text-xs" title={p.description}>
                      <Checkbox checked={picked.has(p.code ?? "")} onCheckedChange={(c) => toggle([p.code ?? ""], c === true)} aria-label={p.code} />
                      <span>
                        <span className="font-mono">{p.code}</span>
                        <span className="text-muted-foreground block">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        {canSave && (
          <Button
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true)
              const ok = await attempt(() => AccessService.saveRole(role?.id, { code, name: name.trim(), description: description.trim() || undefined, permissions: [...picked].sort() }), t("common.saved"))
              setSaving(false)
              if (ok) {
                onSaved()
                onClose()
              }
            }}
          >
            {t("common.save")}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
