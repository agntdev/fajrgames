import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { publicName, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "🏆 Leaderboard", data: "leaderboard:view", order: 70 });
const composer = new Composer<Ctx>();
composer.callbackQuery("leaderboard:view", async (ctx) => { await ctx.answerCallbackQuery(); await withState(ctx, (state, user) => { const players = state.userIds.map((id) => state.users[String(id)]).filter(Boolean).sort((a, b) => b.collectionValue - a.collectionValue || b.boxesOpened - a.boxesOpened).slice(0, 100); const lines = players.length ? players.map((p, i) => `${i + 1}. ${publicName(p)} · ${p.collectionValue} value`).join("\n") : "No collectors yet — open a LuckyBox and claim your spot!"; return ctx.reply(`🏆 Top collectors\n${lines}`, { reply_markup: inlineKeyboard([[inlineButton("👤 My profile", "profile:view")], [inlineButton("⬅️ Back", "menu:main")]]) }); }); });
export default composer;
