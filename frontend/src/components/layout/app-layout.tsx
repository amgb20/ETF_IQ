import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { TopNav } from "./top-nav";
import { Sidebar, MobileSidebarContent } from "./sidebar";
import { ChatbotBar } from "./chatbot-bar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

const STORAGE_KEY = "etfiq-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="relative flex h-screen bg-background overflow-hidden">
      <div className="app-grain fixed inset-0 z-0 pointer-events-none" />
      <div className="app-grid fixed inset-0 z-0 pointer-events-none" />

      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <MobileSidebarContent onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-auto relative z-10">
        <TopNav onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
          <Outlet />
        </main>
        <footer className="border-t border-border bg-card/50 py-3">
          <div className="container mx-auto max-w-7xl px-4 flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground text-center">
              Not financial advice. Informational only. ETF IQ is for educational and research purposes.
            </p>
            <div className="flex gap-3 text-xs">
              <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </div>

      <ChatbotBar />
    </div>
  );
}
