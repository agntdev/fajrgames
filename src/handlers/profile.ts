import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inventoryFor, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "👤 Profile", data: "profile:view", order: 60 });
const composer = new Composer<Ctx>();
composer.callbackQuery("profile:view", async (ctx) => { await ctx.answerCallbackQuery(); await withState(ctx, (state, user) => { const owned = inventoryFor(state, user.id); const total = Object.keys(state.items).length; const completion = total ? Math.min(100, Math.round((new Set(owned.map((entry) => entry.itemId)).size / total) * 100)) : 0; const rarest = owned.map((entry) => state.items[entry.itemId]).filter(Boolean).sort((a, b) => ["Common", "Rare", "Epic", "Legendary"].indexOf(b.rarity) - ["Common", "Rare", "Epic", "Legendary"].indexOf(a.rarity))[0]; return ctx.reply(`${user.name}'s collection\n💎 ${user.gems} Gems · ${owned.length} treasures\n🏆 ${user.collectionValue} collection value · ${user.boxesOpened} boxes opened\n📚 ${completion}% complete\nRarest: ${rarest?.name ?? "No treasure yet"}\nLast opened: ${user.lastOpened ? "Recently" : "Not yet"}`, { reply_markup: inlineKeyboard([[inlineButton("🎒 Inventory", "inventory:view")], [inlineButton("⬅️ Back", "menu:main")]]) }); }); });
export default composer;
