# SaaS Admin Dashboard Template

Универсальный super-admin дашборд для управления SaaS-проектами: метрики MRR/churn, список клиентов, ручная блокировка, история платежей, audit log, impersonation.

## Зачем

Этот репозиторий — **template**. Идея в том, что:

- У тебя есть несколько SaaS-проектов (`computer-repair-hub`, `invoice-manager`, ...)
- Для каждого нужен свой admin dashboard
- Вместо копипасты — клонируешь этот template в каждый проект, настраиваешь `.env.local`
- Когда улучшаешь template — `npm run sync-dashboard` подтягивает обновления

Каждый клон — **независимый dashboard**. Если SaaS продаётся, новый владелец получает свою копию dashboard как часть актива.

## Архитектура

```
┌──────────────────────────────────────┐
│  Admin Supabase (отдельный проект)   │
│  super_admins, payments, audit_log,  │
│  subscriptions, cached_organizations │
└──────────────────────────────────────┘
                  ▲
                  │ (RLS через is_super_admin())
                  │
┌──────────────────────────────────────┐
│  Admin SPA на admin.<domain>          │
│  Vite + React + shadcn/ui            │
└──────────────────────────────────────┘
                  │
                  │ cross-project query
                  ▼
┌──────────────────────────────────────┐
│  Main SaaS Supabase                  │
│  organizations, users, etc.          │
└──────────────────────────────────────┘
```

## Что внутри

- `src-admin/` — React SPA (Login, Dashboard, в будущем — Organizations, Payments и т.д.)
- `supabase/migrations/` — SQL схема для admin Supabase проекта
- `supabase/functions/` — Edge functions: `superadmin-*` (CRUD orgs, payments, audit, impersonation)
- `scripts/sync.js` — копирует обновления из template в проект (sync workflow)

## Быстрый старт (новый SaaS)

См. [SETUP.md](./SETUP.md) — пошаговый гайд подключения template к новому SaaS-проекту.

## Технологии

- **Frontend:** Vite 5, React 18, TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Deploy:** Vercel (рекомендуется отдельный проект для `admin.<domain>`)

## Sprint roadmap

- [x] Sprint 1: Скелет + Login + Dashboard
- [ ] Sprint 2: Edge functions (verify-admin, list-orgs, metrics) + UI Organizations
- [ ] Sprint 3: OrganizationDetail + block/unblock/change-plan
- [ ] Sprint 4: Payments + Audit log + Paddle webhook
- [ ] Sprint 5: Impersonation + SuperAdmins management
- [ ] Sprint 6: Sync скрипт + первый rollout
- [ ] Sprint 7: Безопасность review, MFA, rate limiting

## Лицензия

Приватный template. Не для публичного распространения.
