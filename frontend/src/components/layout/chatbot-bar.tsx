import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { usePortfolios } from "@/hooks/use-portfolios";

export function ChatbotBar() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="chat-bubble-in flex flex-col rounded-2xl border border-border bg-card shadow-2xl
            w-[calc(100vw-2rem)] h-[calc(100vh-6rem)]
            sm:w-[380px] sm:h-[520px]"
        >
          <ChatPanel portfolioId={portfolioId} onClose={() => setIsOpen(false)} />
        </div>
      )}

      <button
        data-chatbot-toggle
        onClick={() => setIsOpen((v) => !v)}
        className={`group flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200
          ${isOpen
            ? "bg-muted text-muted-foreground hover:bg-secondary"
            : "bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl"
          }`}
        aria-label={isOpen ? "Close chat" : "Chat with Charles"}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
