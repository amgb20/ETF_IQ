import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

interface PreferencesUpdate {
  display_name?: string | null;
  base_currency?: string;
  theme?: string;
  notify_email?: boolean;
  notify_digest?: boolean;
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, PreferencesUpdate>({
    mutationFn: (body: PreferencesUpdate) =>
      apiFetch("/users/me/preferences", { method: "PUT", body: JSON.stringify(body) }),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["user-profile"] });
      const previous = qc.getQueryData(["user-profile"]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qc.setQueryData(["user-profile"], (old: any) => ({ ...old, ...variables }));
      return { previous };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (_err: unknown, _vars: unknown, context: any) => {
      qc.setQueryData(["user-profile"], context?.previous);
      toast.error("Failed to save preferences.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Preferences saved.");
    },
  });
}
