// Helper для записи действий super-admin в audit log.
// Использование:
//   await logAction(adminClient, {
//     actor: verified,
//     action: "block_org",
//     target: { type: "organization", id: orgId },
//     details: { reason, previous_status: "active" },
//     request: req,
//   });

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { VerifiedAdmin } from "./verify-admin.ts";

export type AuditTarget = {
  type: "organization" | "user" | "subscription" | "super_admin";
  id: string;
};

export type AuditLogEntry = {
  actor: VerifiedAdmin;
  action: string;
  target?: AuditTarget;
  details?: Record<string, unknown>;
  request?: Request;
};

function extractIp(req?: Request): string | null {
  if (!req) return null;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

export async function logAction(adminServiceClient: SupabaseClient, entry: AuditLogEntry) {
  const { actor, action, target, details, request } = entry;

  const { error } = await adminServiceClient.from("superadmin_audit_log").insert({
    actor_id: actor.adminId,
    actor_email: actor.email,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    details: details ?? null,
    ip_address: extractIp(request),
    user_agent: request?.headers.get("user-agent") ?? null,
  });

  if (error) {
    console.error("[audit-log] failed to log:", error, "entry:", entry);
    // Не бросаем — audit log fail не должен валить основное действие.
    // Но в production стоит подключить алертинг (Sentry, etc).
  }
}
