import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE, apiFetch } from "@/lib/api-client";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tools_used?: { tool: string; query?: string }[] | null;
}

interface SSEEvent {
  type: "text" | "tool" | "tool_result" | "done";
  content?: string;
  name?: string;
  count?: number;
  session_id?: string;
}

export function useChat(portfolioId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem("piq_chat_session"),
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("piq_chat_session", sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !portfolioId) return;
    apiFetch<{ id: string; role: string; content: string; tools_used: any }[]>(
      `/chat/sessions/${sessionId}/messages`,
    )
      .then((history) => {
        setMessages(
          history.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            tools_used: m.tools_used,
          })),
        );
      })
      .catch(() => {
        setSessionId(null);
        localStorage.removeItem("piq_chat_session");
      });
  }, [sessionId, portfolioId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!portfolioId || isStreaming || !text.trim()) return;

      const userMsg: ChatMessage = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setCurrentTool(null);

      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolio_id: portfolioId,
            session_id: sessionId,
            message: text.trim(),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              if (event.type === "text" && event.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + event.content,
                    };
                  }
                  return updated;
                });
              } else if (event.type === "tool") {
                setCurrentTool(event.name ?? null);
              } else if (event.type === "tool_result") {
                setCurrentTool(null);
              } else if (event.type === "done") {
                if (event.session_id) {
                  setSessionId(event.session_id);
                }
              }
            } catch {
              /* skip malformed lines */
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && !last.content) {
              updated[updated.length - 1] = {
                ...last,
                content: "Sorry, something went wrong. Please try again.",
              };
            }
            return updated;
          });
        }
      } finally {
        setIsStreaming(false);
        setCurrentTool(null);
        abortRef.current = null;
      }
    },
    [portfolioId, sessionId, isStreaming],
  );

  const newSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    localStorage.removeItem("piq_chat_session");
  }, []);

  return { messages, isStreaming, currentTool, sessionId, sendMessage, newSession };
}
