import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useChat } from "@/hooks/use-chat";

export function ChatbotBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.[0]?.id;

  const {
    messages,
    isStreaming,
    currentTool,
    sessionId,
    sessions,
    sendMessage,
    newSession,
    switchSession,
    deleteSession,
    renameSession,
  } = useChat(portfolioId);

  const handleNewSession = () => {
    newSession();
    setSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    switchSession(id);
    setSidebarOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="chat-bubble-in flex overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-[0_0_40px_rgba(201,168,76,0.08)]
            w-[calc(100vw-2rem)] h-[calc(100vh-6rem)]
            sm:w-[420px] sm:h-[560px]"
        >
          {sidebarOpen && (
            <div className="w-[200px] shrink-0 border-r border-border">
              <ChatSidebar
                sessions={sessions}
                activeSessionId={sessionId}
                onSelect={handleSelectSession}
                onNew={handleNewSession}
                onDelete={deleteSession}
                onRename={renameSession}
                onCollapse={() => setSidebarOpen(false)}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              currentTool={currentTool}
              onSend={sendMessage}
              onNewSession={handleNewSession}
              onToggleSidebar={() => setSidebarOpen(true)}
              onClose={() => setIsOpen(false)}
              sidebarOpen={sidebarOpen}
            />
          </div>
        </div>
      )}

      <button
        data-chatbot-toggle
        onClick={() => setIsOpen((v) => !v)}
        className={`group flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-[transform,background-color,box-shadow] duration-200
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
