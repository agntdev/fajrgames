import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addAudit, now, today, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "🎁 Daily Reward", data: "daily:claim", order: 80 });
const composer = new Composer<Ctx>();
composer.callbackQuery("daily:claim", async (ctx) => {
  await ctx.answerCallbackQuery();
  await withState(ctx, (state, user) => {
    if (state.paused.daily) return ctx.reply("Daily rewards are taking a tiny nap. Try again soon.");
    const date = today();
    const claimedAt = user.lastClaim ? Date.parse(user.lastClaim) : Number.NaN;
    if (Number.isFinite(claimedAt) && now().getTime() - claimedAt < 24 * 60 * 60 * 1000) return ctx.reply(`You already claimed today's reward. Your streak is ${user.streak} day${user.streak === 1 ? "" : "s"}. Come back tomorrow!`, { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) });
    const yesterday = new Date(now().getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const previousDate = user.lastClaim?.slice(0, 10);
    user.streak = previousDate === yesterday ? user.streak + 1 : 1;
    const reward = 10 + Math.min(user.streak, 7) * 5;
    user.gems += reward; user.lastClaim = now().toISOString(); addAudit(state, user.id, "DAILY_REWARD", String(reward));
    return ctx.reply(`✨ You got ${reward} Gems! Streak: ${user.streak} day${user.streak === 1 ? "" : "s"}. Come back tomorrow for another boost.`, { reply_markup: inlineKeyboard([[inlineButton("🎁 Open LuckyBox", "boxes:list")], [inlineButton("⬅️ Back to menu", "menu:main")]]) });
  });
});
export default composer;
