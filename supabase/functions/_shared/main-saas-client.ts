// Клиент к ОСНОВНОМУ SaaS Supabase (cross-project query).
// Использует service_role основного SaaS — admin читает/пишет organizations,
// profiles, auth.users основного проекта.
//
// Secrets, которые должны быть установлены в admin Supabase:
//   supabase secrets set \
//     MAIN_SAAS_SUPABASE_URL=https://<main>.supabase.co \
//     MAIN_SAAS_SERVICE_ROLE_KEY=<service_role основного SaaS>

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export function getMainSaasClient(): SupabaseClient {
  const url = Deno.env.get("MAIN_SAAS_SUPABASE_URL");
  const key = Deno.env.get("MAIN_SAAS_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "Missing MAIN_SAAS_SUPABASE_URL or MAIN_SAAS_SERVICE_ROLE_KEY in edge function secrets"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Клиент к самому ADMIN Supabase с service_role —
// для INSERT в audit_log (минуя RLS) и других admin-операций.
export function getAdminServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
