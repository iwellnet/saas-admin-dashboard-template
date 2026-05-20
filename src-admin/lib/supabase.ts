import { createClient } from "@supabase/supabase-js";
import { dashboardConfig } from "@/config";

// Admin Supabase — для super_admins, payments, audit_log, метрик
// Использует anon key + JWT super-admin
export const adminSupabase = createClient(
  dashboardConfig.adminSupabase.url,
  dashboardConfig.adminSupabase.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "admin-dashboard-auth",
    },
  }
);

// Базовый URL для вызова edge functions admin Supabase
export const adminFunctionsUrl = `${dashboardConfig.adminSupabase.url}/functions/v1`;
