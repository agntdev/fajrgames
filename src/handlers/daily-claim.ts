import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addAudit, today, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "🎁 Daily Reward", data: "daily:claim", order: 80 });
const composer = new Composer<Ctx>();
composer.callbackQuery("daily:claim", async (ctx) => {
  await ctx.answerCallbackQuery();
  await withState(ctx, (state, user) => {
    if (state.paused.daily) return ctx.reply("Daily rewards are taking a tiny nap. Try again soon.");
    const date = today();
    if (user.lastClaim === date) return ctx.reply(`You already claimed today's reward. Your streak is ${user.streak} day${user.streak === 1 ? "" : "s"}. Come back tomorrow!`, { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) });
    const yesterday = new Date(`${date}T00:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    user.streak = user.lastClaim === yesterday.toISOString().slice(0, 10) ? user.streak + 1 : 1;
    const reward = 10 + Math.min(user.streak, 7) * 5;
    user.gems += reward; user.lastClaim = date; addAudit(state, user.id, "DAILY_REWARD", String(reward));
    return ctx.reply(`✨ You got ${reward} Gems! Streak: ${user.streak} day${user.streak === 1 ? "" : "s"}. Come back tomorrow for another boost.`, { reply_markup: inlineKeyboard([[inlineButton("🎁 Open LuckyBox", "boxes:list")], [inlineButton("⬅️ Back to menu", "menu:main")]]) });
  });
});
export default composer;
