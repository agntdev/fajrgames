import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { publicName, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "🏆 Leaderboard", data: "leaderboard:view", order: 70 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, period = "all-time") { await withState(ctx, (state) => { const players = state.userIds.map((id) => state.users[String(id)]).filter(Boolean).sort((a, b) => b.collectionValue - a.collectionValue || b.boxesOpened - a.boxesOpened).slice(0, 100); const lines = players.length ? players.map((p, i) => `${i + 1}. ${publicName(p)} · ${p.collectionValue} value`).join("\n") : "No collectors yet — open a LuckyBox and claim your spot!"; return ctx.reply(`🏆 Top collectors · ${period}\n${lines}`, { reply_markup: inlineKeyboard([[inlineButton("This week", "leaderboard:weekly"), inlineButton("All time", "leaderboard:alltime")], [inlineButton("👤 My profile", "profile:view")], [inlineButton("⬅️ Back", "menu:main")]]) }); }); }
composer.callbackQuery("leaderboard:view", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx); });
composer.callbackQuery(/^leaderboard:(weekly|alltime)$/, async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, ctx.match[1] === "weekly" ? "this week" : "all-time"); });
export default composer;
