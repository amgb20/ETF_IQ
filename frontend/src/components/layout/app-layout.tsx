import { Outlet, Link } from "react-router-dom";
import { TopNav } from "./top-nav";
import { ChatbotBar } from "./chatbot-bar";

export function AppLayout() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <div className="app-grain fixed inset-0 z-0 pointer-events-none" />
      <div className="app-grid fixed inset-0 z-0 pointer-events-none" />
      <TopNav />
      <main className="relative z-10 flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <Outlet />
      </main>
      <footer className="relative z-10 border-t border-border bg-card/50 py-3">
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
      <ChatbotBar />
    </div>
  );
}
