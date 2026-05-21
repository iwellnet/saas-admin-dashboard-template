// superadmin-get-org
// GET /functions/v1/superadmin-get-org?id=<org_uuid>
//
// Возвращает детальную информацию об одной организации из основного SaaS:
// поля organizations + список пользователей (profiles + auth.users email).

import {
  verifySuperAdmin,
  handleOptions,
  corsResponse,
} from "../_shared/verify-admin.ts";
import { getMainSaasClient } from "../_shared/main-saas-client.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== "GET") return corsResponse({ error: "Method not allowed" }, 405);

  const verified = await verifySuperAdmin(req);
  if (verified instanceof Response) return verified;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return corsResponse({ error: "Missing id" }, 400);

  let mainSaas;
  try {
    mainSaas = getMainSaasClient();
  } catch (e) {
    return corsResponse({ error: (e as Error).message }, 500);
  }

  // Организация
  const { data: org, error: orgErr } = await mainSaas
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (orgErr) return corsResponse({ error: orgErr.message }, 500);
  if (!org) return corsResponse({ error: "Organization not found" }, 404);

  // Пользователи через profiles
  const { data: profiles, error: pErr } = await mainSaas
    .from("profiles")
    .select("id, full_name, role, created_at, deleted_at")
    .eq("organization_id", id)
    .order("created_at", { ascending: true });

  if (pErr) {
    console.warn("[get-org] profiles error:", pErr);
  }

  return corsResponse({ org, users: profiles ?? [] });
});
