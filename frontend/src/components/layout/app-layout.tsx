import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { PerplexitySidebar } from "./perplexity-sidebar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex h-screen bg-background overflow-hidden">
      {/* Subtle overlays (dark mode only) */}
      <div className="app-grain fixed inset-0 z-0 pointer-events-none" />
      <div className="app-grid fixed inset-0 z-0 pointer-events-none" />

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-[220px] shrink-0 h-full relative z-10">
        <PerplexitySidebar />
      </aside>

      {/* ── Mobile sidebar sheet ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <PerplexitySidebar onNavClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-auto relative z-10">
        {/* Mobile header (hamburger only) */}
        <header className="md:hidden sticky top-0 z-40 flex items-center h-12 px-4 border-b border-border bg-background/95 backdrop-blur">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/60 sidebar-transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            to="/"
            className="ml-2 font-brand text-lg tracking-tight"
            style={{ color: "#C9A84C", fontWeight: 600 }}
          >
            ETF IQ
          </Link>
        </header>

        {/* Page content — each page renders its own PageHeader + container */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
