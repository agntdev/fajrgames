import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addAudit, withState } from "../game.js";
import { adminChatId, isOwner, requireOwner, inlineButton, inlineKeyboard, registerMainMenuItem, type OwnerAwareCtx } from "../toolkit/index.js";
registerMainMenuItem({ label: "🛠 Admin", data: "admin:menu", order: 90 });
const composer = new Composer<Ctx>();
const ownerCtx = (ctx: Ctx): OwnerAwareCtx => ctx as unknown as OwnerAwareCtx;
composer.callbackQuery("admin:menu", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ownerCtx(ctx)))) return; await ctx.reply("Owner desk is open. Type `pause boxes`, `resume boxes`, `pause trading`, or `resume trading` to control play.", { reply_markup: inlineKeyboard([[inlineButton("📜 Recent audit", "admin:audit")], [inlineButton("⬅️ Back", "menu:main")]]) }); });
composer.callbackQuery("admin:audit", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ownerCtx(ctx)))) return; await withState(ctx, (state) => { const lines = state.audits.slice(-10).map((audit) => `${audit.action} · ${audit.detail}`).join("\n") || "Nothing has happened yet."; return ctx.reply(`Recent game activity\n${lines}`); }); });
composer.on("message:text", async (ctx, next) => { const text = ctx.message.text.trim().toLowerCase(); if (!/^(pause|resume)\s+(boxes|trading|daily)$/.test(text)) return next(); if (!isOwner(ownerCtx(ctx))) { await requireOwner(ownerCtx(ctx)); return; } await withState(ctx, (state, user) => { const [, verb, feature] = text.match(/^(pause|resume)\s+(boxes|trading|daily)$/) ?? []; state.paused[feature] = verb === "pause"; addAudit(state, user.id, "ADMIN_FEATURE", `${verb}:${feature}`); return ctx.reply(`${feature[0].toUpperCase()}${feature.slice(1)} are ${verb === "pause" ? "paused" : "back in play"}.`); }); });
composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (!/^(add|delete|grant)\s+/i.test(text)) return next();
  if (!(await requireOwner(ownerCtx(ctx)))) return;
  await withState(ctx, (state, user) => {
    const addItemMatch = text.match(/^add item\s+([^|]+)\|([^|]+)\|(Common|Rare|Epic|Legendary)\|(\d+)$/i);
    if (addItemMatch) { const [, itemId, name, rarity, value] = addItemMatch; state.items[itemId.trim()] = { id: itemId.trim(), name: name.trim(), rarity: rarity as "Common" | "Rare" | "Epic" | "Legendary", value: Number(value), description: "A fresh addition to the collection.", tradable: true, unique: false }; addAudit(state, user.id, "ADMIN_ITEM_CREATED", itemId.trim()); return ctx.reply("Item added to the catalogue."); }
    const addBoxMatch = text.match(/^add box\s+([^|]+)\|([^|]+)\|(\d+)\|(.+)$/i);
    if (addBoxMatch) { const [, boxId, name, price, dropsText] = addBoxMatch; const drops = dropsText.split(",").map((part) => { const [itemId, probability] = part.split(":"); return { itemId: itemId.trim(), probability: Number(probability) }; }); const total = drops.reduce((sum, drop) => sum + drop.probability, 0); if (Math.abs(total - 1) > 0.0001 || drops.some((drop) => !state.items[drop.itemId] || drop.probability < 0)) return ctx.reply("That drop table needs real item ids and probabilities that add up to 1.0."); state.boxes[boxId.trim()] = { id: boxId.trim(), name: name.trim(), price: Number(price), drops }; addAudit(state, user.id, "ADMIN_BOX_CREATED", boxId.trim()); return ctx.reply("Box added to the catalogue."); }
    const deleteMatch = text.match(/^delete (item|box)\s+(.+)$/i);
    if (deleteMatch) { const [, kind, key] = deleteMatch; const collection = kind.toLowerCase() === "item" ? state.items : state.boxes; if (!collection[key.trim()]) return ctx.reply("I couldn't find that catalogue entry."); delete collection[key.trim()]; addAudit(state, user.id, "ADMIN_ENTRY_DELETED", `${kind}:${key.trim()}`); return ctx.reply("Catalogue entry deleted."); }
    const grantMatch = text.match(/^grant gems\s+@?([^\s]+)\s+(\d+)$/i);
    if (grantMatch) { const target = Object.values(state.users).find((player) => player.username?.toLowerCase() === grantMatch[1].toLowerCase()); if (!target) return ctx.reply("That player needs to tap /start before you can grant Gems."); target.gems += Number(grantMatch[2]); addAudit(state, user.id, "ADMIN_GEMS_GRANTED", `${target.id}:${grantMatch[2]}`); return ctx.reply("Gems granted and logged."); }
    return ctx.reply("I couldn't parse that owner action. Try add item, add box, delete item, delete box, or grant gems.");
  });
});
composer.callbackQuery("admin:status", async (ctx) => { await ctx.answerCallbackQuery(); const owner = adminChatId(ctx as unknown as { env?: Record<string, unknown> }); await ctx.reply(owner ? "Owner controls are ready." : "Owner access isn't set up yet."); });
export default composer;
