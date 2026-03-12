export const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const url = `${API_BASE}${path}`;
  console.log(`[api] ${method} ${url}`);

  const headers = {
    "Content-Type": "application/json",
    ...init?.headers,
  };
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`[api] ${method} ${url} → ${res.status}`, body);
    throw new Error(body.detail || `API error ${res.status}`);
  }
  if (res.status === 204) {
    console.log(`[api] ${method} ${url} → 204 No Content`);
    return undefined as T;
  }
  const data = await res.json();
  console.log(`[api] ${method} ${url} → ${res.status}`, data);
  return data as T;
}
