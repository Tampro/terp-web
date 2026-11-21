import { Toaster } from "sonner"

import { AuthGuard } from "@/components/auth/auth-guard"
import AdminLayout from "@/components/layout/admin-layout"
import ThemeCustomizer from "@/components/theme-customizer"

export default function LayoutPages({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminLayout>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <ThemeCustomizer />
      </AdminLayout>
    </AuthGuard>
  )
}
