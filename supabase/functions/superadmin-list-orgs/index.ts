// superadmin-list-orgs
// GET /functions/v1/superadmin-list-orgs?plan=trial&search=acme&page=0&pageSize=50
//
// Возвращает список organizations из ОСНОВНОГО SaaS Supabase (cross-project query)
// + user count из profiles. Фильтры опциональные.

import {
  verifySuperAdmin,
  handleOptions,
  corsResponse,
} from "../_shared/verify-admin.ts";
import { getMainSaasClient } from "../_shared/main-saas-client.ts";

type Filters = {
  plan?: string;
  isActive?: boolean;
  search?: string;
  page: number;
  pageSize: number;
};

function parseFilters(url: URL): Filters {
  const plan = url.searchParams.get("plan") || undefined;
  const isActiveStr = url.searchParams.get("isActive");
  const isActive =
    isActiveStr === "true" ? true : isActiveStr === "false" ? false : undefined;
  const search = url.searchParams.get("search") || undefined;
  const page = Math.max(0, Number(url.searchParams.get("page") || 0));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") || 50)));
  return { plan, isActive, search, page, pageSize };
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== "GET") return corsResponse({ error: "Method not allowed" }, 405);

  const verified = await verifySuperAdmin(req);
  if (verified instanceof Response) return verified;

  const url = new URL(req.url);
  const filters = parseFilters(url);

  let mainSaas;
  try {
    mainSaas = getMainSaasClient();
  } catch (e) {
    return corsResponse({ error: (e as Error).message }, 500);
  }

  // Базовый запрос. Колонки manual_block_reason/notes опциональны (могут отсутствовать
  // в основном SaaS, если миграция admin-dashboard-hooks ещё не применена).
  let q = mainSaas
    .from("organizations")
    .select("id, name, slug, plan, is_active, trial_ends_at, created_at", { count: "exact" });

  if (filters.plan) q = q.eq("plan", filters.plan);
  if (filters.isActive !== undefined) q = q.eq("is_active", filters.isActive);
  if (filters.search) {
    const sanitized = filters.search.replace(/[,().]/g, "");
    const s = `%${sanitized}%`;
    q = q.or(`name.ilike.${s},slug.ilike.${s}`);
  }

  const from = filters.page * filters.pageSize;
  const to = from + filters.pageSize - 1;
  q = q.order("created_at", { ascending: false }).range(from, to);

  const { data: orgs, error: orgErr, count } = await q;

  if (orgErr) {
    console.error("[list-orgs] organizations query error:", orgErr);
    return corsResponse({ error: orgErr.message }, 500);
  }

  // Подсчёт пользователей через profiles (только активные).
  // Делаем один запрос с group_by через RPC было бы лучше, но для простоты — N+1
  // на странице (макс 200). При росте — заменить на view в main SaaS.
  const orgIds = (orgs ?? []).map((o) => o.id);
  let userCounts: Record<string, number> = {};
  if (orgIds.length) {
    const { data: profiles, error: pErr } = await mainSaas
      .from("profiles")
      .select("organization_id")
      .in("organization_id", orgIds)
      .is("deleted_at", null);

    if (pErr) {
      console.warn("[list-orgs] profiles count failed, skipping:", pErr);
    } else {
      for (const p of profiles ?? []) {
        const oid = (p as { organization_id: string }).organization_id;
        userCounts[oid] = (userCounts[oid] || 0) + 1;
      }
    }
  }

  const items = (orgs ?? []).map((o) => ({
    ...o,
    user_count: userCounts[o.id] || 0,
  }));

  return corsResponse({
    items,
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  });
});
