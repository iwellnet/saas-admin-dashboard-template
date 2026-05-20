import { useQuery } from "@tanstack/react-query";
import { Building2, DollarSign, Clock, XCircle, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/MetricCard";
import { adminSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { dashboardConfig } from "@/config";

type Metrics = {
  active_paying: number;
  active_trials: number;
  expired: number;
  total_orgs: number;
  manually_blocked: number;
  mrr_usd: number | null;
};

async function fetchMetrics(): Promise<Metrics | null> {
  const { data, error } = await adminSupabase.from("v_saas_metrics").select("*").maybeSingle();
  if (error) {
    console.error("[Dashboard] metrics error:", error);
    return null;
  }
  return data as Metrics | null;
}

export function Dashboard() {
  const { profile, signOut } = useAuth();
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["saas-metrics"],
    queryFn: fetchMetrics,
  });

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : new Intl.NumberFormat("ru-RU").format(n);

  const fmtMoney = (n: number | null | undefined) => {
    if (n == null) return "—";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: dashboardConfig.currency,
      maximumFractionDigits: 0,
    }).format(n);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">{dashboardConfig.saasName} Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <div className="font-medium">{profile?.full_name || profile?.email}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile?.role}</div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Обзор</h2>
          <p className="text-muted-foreground">Ключевые метрики SaaS-бизнеса</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="MRR"
            value={isLoading ? "…" : fmtMoney(metrics?.mrr_usd)}
            hint="Месячная регулярная выручка"
            icon={<DollarSign className="w-4 h-4" />}
          />
          <MetricCard
            title="Активные платящие"
            value={isLoading ? "…" : fmt(metrics?.active_paying)}
            hint="Basic + Pro подписки"
            icon={<Building2 className="w-4 h-4" />}
          />
          <MetricCard
            title="Trial"
            value={isLoading ? "…" : fmt(metrics?.active_trials)}
            hint="Триал ещё не истёк"
            icon={<Clock className="w-4 h-4" />}
          />
          <MetricCard
            title="Истёк"
            value={isLoading ? "…" : fmt(metrics?.expired)}
            hint={`Заблокировано вручную: ${fmt(metrics?.manually_blocked)}`}
            icon={<XCircle className="w-4 h-4" />}
          />
        </div>

        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>Sprint 2 добавит: список организаций, детальную страницу, действия super-admin.</p>
          <p className="text-xs mt-2">
            Метрики берутся из <code>v_saas_metrics</code> в admin Supabase. Если пусто — кэш{" "}
            <code>cached_organizations</code> ещё не заполнен Paddle webhook'ом.
          </p>
        </div>
      </main>
    </div>
  );
}
