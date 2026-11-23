import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/providers/theme-provider"
import UIThemeProvider from "@/providers/ui-theme-provider"
// src/app/layout.tsx
import { BrandApplier } from "@/components/brand-applier"
import { RemoteLabels } from "@/components/remote-labels"
import { TooltipProvider } from "@/components/ui/tooltip"

const themeScript = `
(function () {
  var root = document.documentElement;
  try {
    // brand defaults remembered by <BrandApplier> (erp.brand): used only where the user has no choice of their own
    var brand = null;
    try { brand = JSON.parse(localStorage.getItem("erp.brand") || "null"); } catch (e) {}
    var t = localStorage.getItem("theme") || (brand && brand.mode) || "dark";
    var resolved = t === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : t;

    var ui = brand ? "" : "dark-blue";
    var raw = localStorage.getItem("ui-theme");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && typeof parsed.state.theme === "string" && (parsed.state.chosen || !brand)) {
        ui = parsed.state.theme;
      }
    }
    if (brand && brand.dir === "rtl") root.dir = "rtl";
    if (brand && brand.color && !ui) {
      ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"].forEach(function (v) { root.style.setProperty(v, brand.color); });
      root.style.setProperty("--primary-foreground", "#ffffff");
      root.style.setProperty("--sidebar-primary-foreground", "#ffffff");
    }

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    if (ui) root.classList.add(ui);
  } catch (e) {
    root.classList.add("dark", "dark-blue");
  }
})();
`

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "ERP", template: "%s | ERP" },
  description: "Multi-company ERP SaaS",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6d4aff",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider defaultTheme="dark">
          <UIThemeProvider>
            <RemoteLabels />
            <BrandApplier />
            <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
          </UIThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}