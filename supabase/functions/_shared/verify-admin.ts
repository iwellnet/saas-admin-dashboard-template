// Валидация JWT super-admin'а в edge function.
// Использование:
//   const verified = await verifySuperAdmin(req);
//   if (verified instanceof Response) return verified; // 401 / 403
//   const { adminId, email, role } = verified;

import { createClient } from "npm:@supabase/supabase-js@2";

export type VerifiedAdmin = {
  adminId: string;
  email: string;
  role: "owner" | "support" | "viewer";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function corsResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

export async function verifySuperAdmin(req: Request): Promise<VerifiedAdmin | Response> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return corsResponse({ error: "Missing Authorization header" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return corsResponse({ error: "Empty bearer token" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return corsResponse({ error: "Server misconfiguration" }, 500);
  }

  // Создаём клиент от имени пользователя — RLS будет считать его авторизованным
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return corsResponse({ error: "Invalid token" }, 401);
  }

  // Через RLS политику: если пользователь не super-admin, get вернёт null
  const { data: profile, error: profileErr } = await userClient
    .from("super_admins")
    .select("id, email, role, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileErr) {
    return corsResponse({ error: "Profile lookup failed" }, 500);
  }
  if (!profile || !profile.is_active) {
    return corsResponse({ error: "Forbidden: not a super-admin" }, 403);
  }

  return {
    adminId: profile.id,
    email: profile.email,
    role: profile.role as VerifiedAdmin["role"],
  };
}

export function requireRole(
  verified: VerifiedAdmin,
  allowed: Array<VerifiedAdmin["role"]>
): Response | null {
  if (!allowed.includes(verified.role)) {
    return corsResponse({ error: `Forbidden: role '${verified.role}' is not allowed` }, 403);
  }
  return null;
}
