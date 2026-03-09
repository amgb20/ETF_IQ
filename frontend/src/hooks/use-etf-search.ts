import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface ETFResult {
  id: string;
  isin: string;
  ticker_yf: string | null;
  name: string;
  currency: string | null;
  exchange: string | null;
}

export function useETFSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery<ETFResult[]>({
    queryKey: ["etf-search", debouncedQuery],
    queryFn: () =>
      apiFetch(`/etfs/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });
}

export function useETFDiscover(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery<ETFResult[]>({
    queryKey: ["etf-discover", debouncedQuery],
    queryFn: () =>
      apiFetch(`/etfs/discover?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 120_000,
  });
}
