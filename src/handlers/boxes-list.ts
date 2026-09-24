import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addAudit, addItem, choose, now, withState } from "../game.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "🎁 LuckyBox", data: "boxes:list", order: 10 });
const composer = new Composer<Ctx>();
const back = inlineButton("⬅️ Back", "menu:main");

composer.callbackQuery("boxes:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  await withState(ctx, (state) => {
    const boxes = Object.values(state.boxes);
    if (!boxes.length) return ctx.reply("No LuckyBoxes yet — check back soon.", { reply_markup: inlineKeyboard([[back]]) });
    const rows = boxes.map((box) => [inlineButton(`🎁 ${box.name} · ${box.price} Gems`, `boxes:details:${box.id}`)]);
    rows.push([back]);
    return ctx.reply("Pick a box and see what might pop out!", { reply_markup: inlineKeyboard(rows) });
  });
});
composer.callbackQuery(/^boxes:details:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const boxId = ctx.match[1];
  await withState(ctx, (state) => {
    const box = state.boxes[boxId];
    if (!box) return ctx.editMessageText("That box slipped away — tap LuckyBox to refresh.", { reply_markup: inlineKeyboard([[back]]) });
    const rarity = box.drops.map((drop) => `${state.items[drop.itemId]?.rarity ?? "Mystery"} ${Math.round(drop.probability * 100)}%`).join(" · ");
    return ctx.editMessageText(`${box.name} costs ${box.price} Gems.\nDrop chances: ${rarity}`, { reply_markup: inlineKeyboard([[inlineButton("🎁 Buy", `boxes:buy:${box.id}`)], [back]]) });
  });
});
composer.callbackQuery(/^boxes:buy:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const boxId = ctx.match[1];
  await withState(ctx, (state, user) => {
    const box = state.boxes[boxId];
    if (!box) return ctx.reply("That box slipped away — tap LuckyBox to refresh.");
    if (user.gems < box.price) return ctx.reply(`You need ${box.price} Gems, but you have ${user.gems}. Claim your daily reward for a boost!`, { reply_markup: inlineKeyboard([[inlineButton("🎁 Daily Reward", "daily:claim")], [back]]) });
    return ctx.reply(`Ready to open ${box.name} for ${box.price} Gems?`, { reply_markup: inlineKeyboard([[inlineButton("✨ Confirm", `boxes:confirm:${box.id}`), inlineButton("Cancel", "boxes:cancel")]]) });
  });
});
composer.callbackQuery("boxes:cancel", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("No worries — your Gems are safe.", { reply_markup: inlineKeyboard([[back]]) }); });
composer.callbackQuery(/^boxes:confirm:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const boxId = ctx.match[1];
  await withState(ctx, async (state, user) => {
    const box = state.boxes[boxId];
    if (!box || state.paused.boxes) return ctx.editMessageText("Box openings are taking a tiny nap. Try again soon.", { reply_markup: inlineKeyboard([[back]]) });
    const current = now().getTime();
    const cutoff = current - 60_000;
    user.boxOpens = (user.boxOpens ?? []).filter((stamp) => stamp > cutoff);
    if (user.boxOpens.length >= 5) return ctx.editMessageText("That’s a lot of luck in one minute! Take a short breather, then try again.", { reply_markup: inlineKeyboard([[back]]) });
    if (user.gems < box.price) return ctx.editMessageText("You don't have enough Gems for that one.", { reply_markup: inlineKeyboard([[back]]) });
    const item = state.items[choose(box)];
    if (!item) return ctx.editMessageText("That box needs a quick tune-up. Try again soon.", { reply_markup: inlineKeyboard([[back]]) });
    user.boxOpens.push(current); user.gems -= box.price; user.boxesOpened += 1; user.xp += item.value;
    addItem(state, user, item); user.collectionValue += item.value;
    addAudit(state, user.id, "BOX_OPENED", `${box.id}:${item.id}`);
    await ctx.editMessageText("🎁 Opening LuckyBox...", { reply_markup: inlineKeyboard([]) });
    await ctx.reply("🔮 Finding your reward...");
    return ctx.reply(`✨ You got ${item.name}!\n${item.rarity} · ${item.description}\nGems left: ${user.gems}`, { reply_markup: inlineKeyboard([[inlineButton("🎁 Open another", `boxes:buy:${box.id}`), inlineButton("🎒 Inventory", "inventory:view")], [back]]) });
  });
});
export default composer;
