-- ============================================================
-- SaaS Admin Dashboard — базовая схема
-- Применяется в ОТДЕЛЬНОМ Supabase проекте (admin Supabase),
-- НЕ в основном SaaS Supabase!
-- ============================================================

-- ============================================================
-- 1. Таблица super-админов
-- ============================================================
CREATE TABLE IF NOT EXISTS public.super_admins (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL UNIQUE,
  full_name     text,
  role          text NOT NULL CHECK (role IN ('owner','support','viewer')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  last_login_at timestamptz
);

-- ============================================================
-- 2. Платежи (зеркало Paddle transactions, локальная копия)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_organization_id   uuid NOT NULL,
  paddle_transaction_id  text UNIQUE NOT NULL,
  paddle_subscription_id text,
  paddle_customer_id     text,
  amount                 numeric(12,2) NOT NULL,
  currency               text NOT NULL,
  status                 text NOT NULL,
  plan                   text,
  billing_period_start   timestamptz,
  billing_period_end     timestamptz,
  invoice_url            text,
  raw_event              jsonb,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_org ON public.payments(main_organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at DESC);

-- ============================================================
-- 3. Подписки (зеркало Paddle subscriptions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_organization_id   uuid NOT NULL,
  paddle_subscription_id text UNIQUE,
  plan                   text NOT NULL,
  status                 text NOT NULL,
  started_at             timestamptz NOT NULL,
  ended_at               timestamptz,
  next_billed_at         timestamptz,
  cancel_at_period_end   boolean DEFAULT false,
  raw_event              jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(main_organization_id);

-- ============================================================
-- 4. Audit log действий super-admin (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.superadmin_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid NOT NULL REFERENCES public.super_admins(id),
  actor_email  text NOT NULL,
  action       text NOT NULL,
  target_type  text,
  target_id    uuid,
  details      jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.superadmin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.superadmin_audit_log(target_type, target_id);

-- ============================================================
-- 5. Кэш организаций из основного SaaS (для метрик)
-- Обновляется через webhook от основного SaaS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cached_organizations (
  id                  uuid PRIMARY KEY,
  name                text NOT NULL,
  slug                text,
  plan                text,
  is_active           boolean,
  trial_ends_at       timestamptz,
  manual_block_reason text,
  notes               text,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  raw_data            jsonb
);
CREATE INDEX IF NOT EXISTS idx_cached_orgs_plan ON public.cached_organizations(plan);
CREATE INDEX IF NOT EXISTS idx_cached_orgs_active ON public.cached_organizations(is_active);

-- ============================================================
-- 6. Helper-функции для RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.super_admin_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.super_admins
  WHERE id = auth.uid() AND is_active = true;
$$;

-- ============================================================
-- 7. RLS политики
-- ============================================================
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_select ON public.super_admins;
CREATE POLICY sa_select ON public.super_admins
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS sa_modify ON public.super_admins;
CREATE POLICY sa_modify ON public.super_admins
  FOR ALL USING (public.super_admin_role() = 'owner');

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_select ON public.payments;
CREATE POLICY p_select ON public.payments
  FOR SELECT USING (public.is_super_admin());

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS s_select ON public.subscriptions;
CREATE POLICY s_select ON public.subscriptions
  FOR SELECT USING (public.is_super_admin());

ALTER TABLE public.superadmin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS al_select ON public.superadmin_audit_log;
CREATE POLICY al_select ON public.superadmin_audit_log
  FOR SELECT USING (public.is_super_admin());
-- INSERT/UPDATE/DELETE — только через service_role (edge functions)

ALTER TABLE public.cached_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS co_select ON public.cached_organizations;
CREATE POLICY co_select ON public.cached_organizations
  FOR SELECT USING (public.is_super_admin());

-- ============================================================
-- 8. Аналитический view для метрик dashboard
-- ============================================================
CREATE OR REPLACE VIEW public.v_saas_metrics AS
SELECT
  count(*) FILTER (WHERE plan IN ('basic','pro') AND is_active)        AS active_paying,
  count(*) FILTER (WHERE plan = 'trial' AND trial_ends_at > now())     AS active_trials,
  count(*) FILTER (WHERE plan = 'expired')                             AS expired,
  count(*)                                                              AS total_orgs,
  count(*) FILTER (WHERE manual_block_reason IS NOT NULL)              AS manually_blocked,
  -- MRR: суммируем фиксированные цены планов (можно переопределить через JOIN с конфигом)
  sum(CASE plan WHEN 'basic' THEN 29 WHEN 'pro' THEN 79 ELSE 0 END)    AS mrr_usd
FROM public.cached_organizations;

-- Права для роли authenticated (RLS контролирует, какие строки видны)
GRANT SELECT ON public.super_admins TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.super_admins TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.superadmin_audit_log TO authenticated;
GRANT SELECT ON public.cached_organizations TO authenticated;
GRANT SELECT ON public.v_saas_metrics TO authenticated;

-- ============================================================
-- 9. Триггер автоматического обновления updated_at для subscriptions
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
