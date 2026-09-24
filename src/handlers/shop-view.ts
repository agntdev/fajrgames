import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addAudit, addItem, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "🛒 Shop", data: "shop:view", order: 30 });
const composer = new Composer<Ctx>();
composer.callbackQuery("shop:view", async (ctx) => { await ctx.answerCallbackQuery(); await withState(ctx, (state) => { const rows = Object.values(state.items).map((item) => [inlineButton(`${item.name} · ${item.value * 2} Gems`, `shop:buy:${item.id}`)]); rows.push([inlineButton("🎁 LuckyBox", "boxes:list")], [inlineButton("⬅️ Back", "menu:main")]); return ctx.reply("Welcome to the tiny treasure shop!", { reply_markup: inlineKeyboard(rows) }); }); });
composer.callbackQuery(/^shop:buy:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await withState(ctx, (state, user) => { const item = state.items[ctx.match[1]]; const price = item ? item.value * 2 : 0; if (!item) return ctx.reply("That treasure sold out — tap Shop to refresh."); if (user.gems < price) return ctx.reply("You need more Gems for that treasure. Try the daily reward!"); user.gems -= price; addItem(state, user, item); user.collectionValue += item.value; addAudit(state, user.id, "ITEM_PURCHASED", item.id); return ctx.reply(`✨ ${item.name} is yours! You have ${user.gems} Gems left.`, { reply_markup: inlineKeyboard([[inlineButton("🎒 Inventory", "inventory:view")], [inlineButton("🛒 Shop", "shop:view")]]) }); }); });
export default composer;
