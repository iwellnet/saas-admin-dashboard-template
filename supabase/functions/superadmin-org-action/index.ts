// superadmin-org-action
// POST /functions/v1/superadmin-org-action
//
// Body: { action, org_id, ...params }
//
// Доступные actions:
//   block          – заблокировать организацию (is_active=false + manual_block_*)
//   unblock        – разблокировать (is_active=true, очистить manual_block_*)
//   change_plan    – сменить план: { plan: "trial"|"basic"|"pro" }
//   extend_trial   – продлить триал: { days: number }

import {
  verifySuperAdmin,
  requireRole,
  handleOptions,
  corsResponse,
} from "../_shared/verify-admin.ts";
import { getMainSaasClient, getAdminServiceClient } from "../_shared/main-saas-client.ts";
import { logAction } from "../_shared/audit-log.ts";

type ActionBody =
  | { action: "block";       org_id: string; reason: string; notes?: string }
  | { action: "unblock";     org_id: string }
  | { action: "change_plan"; org_id: string; plan: "trial" | "basic" | "pro" }
  | { action: "extend_trial"; org_id: string; days: number };

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== "POST") return corsResponse({ error: "Method not allowed" }, 405);

  const verified = await verifySuperAdmin(req);
  if (verified instanceof Response) return verified;

  const roleErr = requireRole(verified, ["owner", "support"]);
  if (roleErr) return roleErr;

  let body: ActionBody;
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.action || !body.org_id) {
    return corsResponse({ error: "Missing action or org_id" }, 400);
  }

  let mainSaas;
  try {
    mainSaas = getMainSaasClient();
  } catch (e) {
    return corsResponse({ error: (e as Error).message }, 500);
  }

  // Проверяем что организация существует
  const { data: org, error: findErr } = await mainSaas
    .from("organizations")
    .select("id, name, plan, is_active")
    .eq("id", body.org_id)
    .maybeSingle();

  if (findErr) return corsResponse({ error: findErr.message }, 500);
  if (!org) return corsResponse({ error: "Organization not found" }, 404);

  let updatePayload: Record<string, unknown> = {};
  let auditMeta: Record<string, unknown> = {};

  switch (body.action) {
    case "block":
      if (!body.reason) return corsResponse({ error: "Missing reason" }, 400);
      updatePayload = {
        is_active: false,
        manual_blocked_at: new Date().toISOString(),
        manual_blocked_by: verified.email,
        manual_block_reason: body.reason,
        manual_block_notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      auditMeta = { reason: body.reason, notes: body.notes };
      break;

    case "unblock":
      updatePayload = {
        is_active: true,
        manual_blocked_at: null,
        manual_blocked_by: null,
        manual_block_reason: null,
        manual_block_notes: null,
        updated_at: new Date().toISOString(),
      };
      break;

    case "change_plan": {
      const planRoleErr = requireRole(verified, ["owner"]);
      if (planRoleErr) return planRoleErr;
      const allowed = ["trial", "basic", "pro"];
      if (!allowed.includes(body.plan)) {
        return corsResponse({ error: `Invalid plan: ${body.plan}` }, 400);
      }
      updatePayload = {
        plan: body.plan,
        updated_at: new Date().toISOString(),
      };
      auditMeta = { from: org.plan, to: body.plan };
      break;
    }

    case "extend_trial": {
      const days = Number(body.days);
      if (!days || days < 1 || days > 365) {
        return corsResponse({ error: "days must be between 1 and 365" }, 400);
      }
      // Продлеваем от текущей даты + days
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);
      updatePayload = {
        trial_ends_at: newDate.toISOString(),
        updated_at: new Date().toISOString(),
      };
      auditMeta = { days, new_trial_ends_at: newDate.toISOString() };
      break;
    }

    default:
      return corsResponse({ error: `Unknown action: ${(body as ActionBody).action}` }, 400);
  }

  const { error: updateErr } = await mainSaas
    .from("organizations")
    .update(updatePayload)
    .eq("id", body.org_id);

  if (updateErr) return corsResponse({ error: updateErr.message }, 500);

  // Audit log
  try {
    const adminClient = getAdminServiceClient();
    await logAction(adminClient, {
      actor: verified,
      action: body.action,
      target: { type: "organization", id: body.org_id },
      details: { org_name: org.name, ...auditMeta },
      request: req,
    });
  } catch (e) {
    console.warn("[org-action] audit log failed:", e);
  }

  return corsResponse({ ok: true, action: body.action, org_id: body.org_id });
});
