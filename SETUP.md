# SETUP: Подключение admin dashboard к новому SaaS-проекту

Этот гайд описывает, как из template создать рабочий admin dashboard для одного конкретного SaaS-проекта.

## Что должно быть готово до старта

- Основной SaaS-проект работает (свой Supabase, свой деплой)
- Аккаунт Supabase для создания **второго** проекта (admin)
- Аккаунт Vercel для деплоя admin SPA
- DNS-доступ к домену (для поддомена `admin.<domain>`)

---

## Шаг 1. Создать admin Supabase проект

1. Зайти на https://supabase.com → New project
2. Имя: `<saas-name>-admin` (например `computer-repair-hub-admin`)
3. Записать **URL** и **anon key**, **service_role key**
4. Применить миграцию из template:

```bash
# Вариант A: через Supabase CLI
supabase link --project-ref <admin-project-ref>
supabase db push

# Вариант B: вручную скопировать SQL из supabase/migrations/00000000000000_admin_schema.sql
# в Supabase Dashboard → SQL Editor → Run
```

5. Установить secrets для edge functions:

```bash
supabase secrets set \
  MAIN_SAAS_SUPABASE_URL=https://yyyyy.supabase.co \
  MAIN_SAAS_SERVICE_ROLE_KEY=<service_role_основного_SaaS>
```

---

## Шаг 2. Клонировать template в SaaS проект

```bash
cd path/to/your-saas
git clone https://github.com/iwellnet/saas-admin-dashboard-template admin-dashboard
cd admin-dashboard
rm -rf .git    # отвязываем от template, теперь это часть SaaS репо
cp .env.example .env.local
```

---

## Шаг 3. Заполнить `.env.local`

```env
VITE_SAAS_NAME="Computer Repair Hub"
VITE_SUPPORT_EMAIL="support@computerrepairmasters.com"
VITE_CURRENCY="USD"

# Admin Supabase (из Шага 1)
VITE_ADMIN_SUPABASE_URL=https://xxxxx.supabase.co
VITE_ADMIN_SUPABASE_ANON_KEY=eyJhbG...

# Main SaaS Supabase (только URL, секреты в edge function secrets)
VITE_MAIN_SAAS_SUPABASE_URL=https://yyyyy.supabase.co

# Билинг
VITE_BILLING_PROVIDER=paddle
VITE_PLANS_JSON='[{"id":"basic","name":"Basic","price":29},{"id":"pro","name":"Pro","price":79}]'
VITE_TRIAL_DAYS=14
```

---

## Шаг 4. Установить и запустить локально

```bash
npm install
npm run dev
# открой http://localhost:8081
```

Если конфиг неправильный — увидишь ошибку с подсказкой какие переменные отсутствуют.

---

## Шаг 5. Создать первого super-admin

В admin Supabase:

1. Dashboard → **Authentication** → Add user → создать с email/паролем
2. Скопировать UUID нового пользователя
3. SQL Editor:

```sql
INSERT INTO public.super_admins (id, email, full_name, role)
VALUES ('<uuid-из-auth.users>', 'owner@email.com', 'Owner', 'owner');
```

Теперь можно зайти на http://localhost:8081 → ввести email/пароль → попасть в Dashboard.

---

## Шаг 6. Расширить webhook основного SaaS

В **основном SaaS-проекте** (не admin) нужно расширить Paddle webhook чтобы дублировал события в admin БД.

См. инструкцию ниже (будет добавлена в Sprint 4).

---

## Шаг 7. Деплой на Vercel

1. Vercel Dashboard → Add New Project → Import текущего SaaS репо
2. **Root Directory:** `admin-dashboard/`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables: скопировать все `VITE_*` из `.env.local`
6. Settings → Domains → добавить `admin.<your-domain>`

---

## Обновление dashboard в будущем

Когда в template-репо появляется новая фича или баг-фикс:

```bash
# 1. На локальной машине обнови клон template
cd ~/code/saas-admin-dashboard-template
git pull

# 2. В каждом SaaS-проекте, который использует dashboard
cd ~/code/computer-repair-hub
npm run sync-dashboard -- --template ../saas-admin-dashboard-template

# 3. Проверь diff и коммить
git diff admin-dashboard/
git add admin-dashboard/ && git commit -m "Sync admin dashboard"
git push
```

Vercel автоматически перезаливает.

---

## Если SaaS продаётся

Новый владелец получает полный SaaS репо вместе с `admin-dashboard/`. Никакой зависимости от твоей инфраструктуры нет — он:

1. Создаёт свой Supabase admin проект
2. Меняет `.env.local` под свои значения
3. Деплоит на свой Vercel

Дальше может развивать dashboard независимо или подключить sync к своему форку template.
