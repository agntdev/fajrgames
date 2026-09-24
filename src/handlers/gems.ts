import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "💎 Gems", data: "gems:view", order: 40 });
const composer = new Composer<Ctx>();
composer.callbackQuery("gems:view", async (ctx) => { await ctx.answerCallbackQuery(); await withState(ctx, (state, user) => ctx.reply(`You have ${user.gems} Gems 💎\nOpen boxes, claim your daily reward, and keep collecting.`, { reply_markup: inlineKeyboard([[inlineButton("🎁 Daily Reward", "daily:claim"), inlineButton("🎁 LuckyBox", "boxes:list")], [inlineButton("⬅️ Back", "menu:main")]]) })); });
export default composer;
