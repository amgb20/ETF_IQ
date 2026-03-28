import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ChatSession } from "@/hooks/use-chat";

export function useChatSessions(portfolioId: string | undefined) {
  return useQuery<ChatSession[]>({
    queryKey: ["chat-sessions", portfolioId],
    queryFn: () => apiFetch(`/chat/sessions?portfolio_id=${portfolioId}`),
    enabled: !!portfolioId,
    refetchInterval: 30_000,
  });
}

export function useDeleteChatSession(portfolioId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/chat/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-sessions", portfolioId] });
    },
  });
}

export function useRenameChatSession(portfolioId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      apiFetch(`/chat/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-sessions", portfolioId] });
    },
  });
}

export function useDeleteChatSessions(portfolioId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionIds: string[]) =>
      apiFetch("/chat/sessions/batch-delete", {
        method: "POST",
        body: JSON.stringify({ session_ids: sessionIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-sessions", portfolioId] });
    },
  });
}
