import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";
import { apiFetch } from "@/lib/api-client";

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  base_currency: string;
  role: string;
  notify_email: boolean;
  notify_digest: boolean;
  accepted_tos: boolean;
  is_onboarded: boolean;
  theme: string;
}

export function useUser() {
  const { isAuthenticated } = useUserContext();

  return useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: () => apiFetch("/users/me"),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });
}
