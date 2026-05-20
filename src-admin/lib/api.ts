import { adminSupabase, adminFunctionsUrl } from "./supabase";

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await adminSupabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function callAdminFunction<T = unknown>(
  name: string,
  options: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const { method = "GET", body, query } = options;
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  };

  const url = new URL(`${adminFunctionsUrl}/${name}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${name} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}
