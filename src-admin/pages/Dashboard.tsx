import { useQuery } from "@tanstack/react-query";
import { Building2, DollarSign, Clock, XCircle } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { adminSupabase } from "@/lib/supabase";
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
    <div className="p-8 space-y-6">
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
        <p>В следующих спринтах добавятся: детальная страница организации, действия super-admin, история платежей, audit log.</p>
        <p className="text-xs mt-2">
          Метрики берутся из <code>v_saas_metrics</code> в admin Supabase. Если пусто — кэш{" "}
          <code>cached_organizations</code> ещё не заполнен Paddle webhook'ом.
        </p>
      </div>
    </div>
  );
}
