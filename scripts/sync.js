#!/usr/bin/env node
/**
 * sync.js — копирует обновления из template в текущий admin-dashboard/.
 *
 * Использование:
 *   npm run sync-dashboard -- --template ../saas-admin-dashboard-template
 *
 * Полная реализация будет в Sprint 6.
 * Сейчас — заглушка с подсказкой что делать.
 */

const args = process.argv.slice(2);
const templateIdx = args.indexOf("--template");
const templatePath = templateIdx >= 0 ? args[templateIdx + 1] : null;

if (!templatePath) {
  console.error("Использование: npm run sync-dashboard -- --template <path-to-template-clone>");
  console.error("Пример:        npm run sync-dashboard -- --template ../saas-admin-dashboard-template");
  process.exit(1);
}

console.log("");
console.log("=== sync.js (заглушка Sprint 1) ===");
console.log(`Template path: ${templatePath}`);
console.log("");
console.log("Полная реализация в Sprint 6 будет:");
console.log("  1. Копировать src-admin/, supabase/, scripts/, package.json, конфиги");
console.log("  2. ИСКЛЮЧАТЬ: .env.local, .env, node_modules/, dist/, .git/");
console.log("  3. Сравнивать templateVersion в package.json");
console.log("  4. Логировать изменённые файлы");
console.log("  5. Подсказывать: проверь git diff перед коммитом");
console.log("");
console.log("Пока — копируй файлы вручную или жди Sprint 6.");
