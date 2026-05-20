type Plan = { id: string; name: string; price: number };

function parsePlans(json: string | undefined): Plan[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    console.warn("[config] Invalid VITE_PLANS_JSON, using empty list");
    return [];
  }
}

export const dashboardConfig = {
  saasName: import.meta.env.VITE_SAAS_NAME || "SaaS Admin",
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || "",
  currency: import.meta.env.VITE_CURRENCY || "USD",

  adminSupabase: {
    url: import.meta.env.VITE_ADMIN_SUPABASE_URL || "",
    anonKey: import.meta.env.VITE_ADMIN_SUPABASE_ANON_KEY || "",
  },

  mainSaasSupabase: {
    url: import.meta.env.VITE_MAIN_SAAS_SUPABASE_URL || "",
  },

  billingProvider: import.meta.env.VITE_BILLING_PROVIDER || "paddle",
  plans: parsePlans(import.meta.env.VITE_PLANS_JSON),

  trial: {
    daysDefault: Number(import.meta.env.VITE_TRIAL_DAYS) || 14,
    daysMaxExtend: 30,
  },
};

export function assertConfigValid() {
  const errors: string[] = [];
  if (!dashboardConfig.adminSupabase.url) errors.push("VITE_ADMIN_SUPABASE_URL отсутствует");
  if (!dashboardConfig.adminSupabase.anonKey) errors.push("VITE_ADMIN_SUPABASE_ANON_KEY отсутствует");
  if (!dashboardConfig.mainSaasSupabase.url) errors.push("VITE_MAIN_SAAS_SUPABASE_URL отсутствует");
  if (errors.length) {
    throw new Error(`[admin-dashboard] Неверная конфигурация:\n${errors.join("\n")}\nПроверь .env.local`);
  }
}
