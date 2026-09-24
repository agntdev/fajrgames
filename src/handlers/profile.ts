import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inventoryFor, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "👤 Profile", data: "profile:view", order: 60 });
const composer = new Composer<Ctx>();
composer.callbackQuery("profile:view", async (ctx) => { await ctx.answerCallbackQuery(); await withState(ctx, (state, user) => ctx.reply(`${user.name}'s collection\n💎 ${user.gems} Gems · ${inventoryFor(state, user.id).length} treasures\n🏆 ${user.collectionValue} collection value · ${user.boxesOpened} boxes opened`, { reply_markup: inlineKeyboard([[inlineButton("🎒 Inventory", "inventory:view")], [inlineButton("⬅️ Back", "menu:main")]]) })); });
export default composer;
