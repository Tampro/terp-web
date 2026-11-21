"use client"

import { create } from "zustand"

import { tokenStore } from "@/lib/api"
import { AuthService, type MeDto, type ProfileDto } from "@/lib/auth/auth.service"

interface AuthState {
  me?: MeDto
  profile?: ProfileDto
  status: "idle" | "loading" | "ready" | "anonymous"
  load: () => Promise<void>
  setProfile: (p: ProfileDto) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  async load() {
    if (!tokenStore.access) return set({ status: "anonymous" })
    if (get().status === "loading") return
    set({ status: "loading" })
    try {
      const [me, profile] = await Promise.all([AuthService.me(), AuthService.getProfile()])
      set({ me, profile, status: "ready" })
    } catch {
      set({ status: tokenStore.access ? "ready" : "anonymous" })
    }
  },
  setProfile: (profile) => set({ profile }),
  async logout() {
    await AuthService.logout().catch(() => undefined)
    set({ me: undefined, profile: undefined, status: "anonymous" })
  },
}))
