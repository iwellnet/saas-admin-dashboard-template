import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldOff, ShieldCheck, RefreshCw, CreditCard,
  Users, Calendar, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { callAdminFunction } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  manual_blocked_at: string | null;
  manual_blocked_by: string | null;
  manual_block_reason: string | null;
  manual_block_notes: string | null;
};

type OrgUser = {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  deleted_at: string | null;
};

type OrgDetailResponse = { org: Org; users: OrgUser[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const planVariant: Record<string, "default" | "secondary" | "destructive" | "warning" | "success"> = {
  trial: "warning",
  basic: "secondary",
  pro: "success",
  expired: "destructive",
};

const BLOCK_REASONS = [
  { value: "fraud",       label: "Мошенничество / фрод" },
  { value: "non_payment", label: "Неоплата" },
  { value: "abuse",       label: "Нарушение условий" },
  { value: "other",       label: "Другое" },
];

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Загрузка данных
  const { data, isLoading, error } = useQuery({
    queryKey: ["org", id],
    queryFn: () => callAdminFunction<OrgDetailResponse>("superadmin-get-org", { query: { id: id! } }),
    enabled: !!id,
  });

  // Диалоги
  const [dialog, setDialog] = useState<
    null | "block" | "unblock" | "change_plan" | "extend_trial"
  >(null);
  const [blockReason, setBlockReason] = useState("fraud");
  const [blockNotes, setBlockNotes] = useState("");
  const [newPlan, setNewPlan] = useState<"trial" | "basic" | "pro">("basic");
  const [trialDays, setTrialDays] = useState("14");

  // Мутация
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      callAdminFunction("superadmin-org-action", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", id] });
      qc.invalidateQueries({ queryKey: ["orgs"] });
      setDialog(null);
      setBlockNotes("");
    },
  });

  const doAction = () => {
    if (!id) return;
    if (dialog === "block")
      mutation.mutate({ action: "block", org_id: id, reason: blockReason, notes: blockNotes || undefined });
    else if (dialog === "unblock")
      mutation.mutate({ action: "unblock", org_id: id });
    else if (dialog === "change_plan")
      mutation.mutate({ action: "change_plan", org_id: id, plan: newPlan });
    else if (dialog === "extend_trial")
      mutation.mutate({ action: "extend_trial", org_id: id, days: Number(trialDays) });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (error || !data)
    return <div className="p-8 text-destructive">Ошибка: {(error as Error)?.message ?? "не найдено"}</div>;

  const { org, users } = data;
  const isBlocked = !org.is_active && !!org.manual_blocked_at;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Заголовок */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Назад
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{org.name}</h2>
          <p className="text-muted-foreground text-sm">{org.slug}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={planVariant[org.plan] || "outline"}>{org.plan}</Badge>
          {org.is_active
            ? <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Активна</Badge>
            : <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Заблокирована</Badge>
          }
        </div>
      </div>

      {/* Блок предупреждения если заблокировано */}
      {isBlocked && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-4 space-y-1 text-sm">
            <p className="font-semibold text-destructive">Организация заблокирована вручную</p>
            <p>Причина: <span className="font-medium">{org.manual_block_reason}</span></p>
            {org.manual_block_notes && <p>Заметки: {org.manual_block_notes}</p>}
            <p className="text-muted-foreground">
              {org.manual_blocked_by} · {fmt(org.manual_blocked_at)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Действия */}
      <div className="flex flex-wrap gap-2">
        {org.is_active ? (
          <Button variant="destructive" size="sm" onClick={() => setDialog("block")}>
            <ShieldOff className="w-4 h-4 mr-2" /> Заблокировать
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={() => setDialog("unblock")}>
            <ShieldCheck className="w-4 h-4 mr-2" /> Разблокировать
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setDialog("change_plan")}>
          <CreditCard className="w-4 h-4 mr-2" /> Сменить план
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("extend_trial")}>
          <RefreshCw className="w-4 h-4 mr-2" /> Продлить триал
        </Button>
      </div>

      {/* Детали */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Общее</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="ID" value={org.id} mono />
            <Row label="Slug" value={org.slug} />
            <Row label="Зарегистрирована" value={fmt(org.created_at)} />
            <Row label="Обновлена" value={fmt(org.updated_at)} />
            <Row label="Trial до" value={fmt(org.trial_ends_at)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Биллинг</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="Stripe Customer" value={org.stripe_customer_id} mono />
            <Row label="Stripe Subscription" value={org.stripe_subscription_id} mono />
          </CardContent>
        </Card>
      </div>

      {/* Пользователи */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Пользователи ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет пользователей</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2">Имя</th>
                  <th className="text-left pb-2">Роль</th>
                  <th className="text-left pb-2">Добавлен</th>
                  <th className="text-left pb-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2">{u.full_name || "—"}</td>
                    <td className="py-2 text-muted-foreground">{u.role}</td>
                    <td className="py-2 text-muted-foreground">{fmt(u.created_at)}</td>
                    <td className="py-2">
                      {u.deleted_at
                        ? <Badge variant="destructive" className="text-xs">Удалён</Badge>
                        : <Badge variant="success" className="text-xs">Активен</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      {/* Блокировка */}
      <Dialog open={dialog === "block"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Заблокировать организацию</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Причина</Label>
              <Select value={blockReason} onValueChange={setBlockReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCK_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Заметки (необязательно)</Label>
              <Textarea
                placeholder="Дополнительная информация…"
                value={blockNotes}
                onChange={(e) => setBlockNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Отмена</Button>
            <Button variant="destructive" onClick={doAction} disabled={mutation.isPending}>
              {mutation.isPending ? "…" : "Заблокировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Разблокировка */}
      <Dialog open={dialog === "unblock"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Разблокировать организацию?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Организация снова станет активной. Действие записывается в audit log.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Отмена</Button>
            <Button onClick={doAction} disabled={mutation.isPending}>
              {mutation.isPending ? "…" : "Разблокировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Смена плана */}
      <Dialog open={dialog === "change_plan"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Сменить план</DialogTitle></DialogHeader>
          <div className="space-y-1 py-2">
            <Label>Новый план</Label>
            <Select value={newPlan} onValueChange={(v) => setNewPlan(v as typeof newPlan)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Отмена</Button>
            <Button onClick={doAction} disabled={mutation.isPending}>
              {mutation.isPending ? "…" : "Сменить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Продление триала */}
      <Dialog open={dialog === "extend_trial"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Продлить триал</DialogTitle></DialogHeader>
          <div className="space-y-1 py-2">
            <Label>Количество дней</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Новая дата: {(() => {
                const d = new Date();
                d.setDate(d.getDate() + Number(trialDays));
                return d.toLocaleDateString("ru-RU");
              })()}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Отмена</Button>
            <Button onClick={doAction} disabled={mutation.isPending}>
              {mutation.isPending ? "…" : "Продлить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper component ─────────────────────────────────────────────────────────

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}
