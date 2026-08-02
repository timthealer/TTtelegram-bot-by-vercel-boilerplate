// src/bot.ts
import { Telegraf } from "telegraf";
import axios from "axios";
import { funnelToInbox } from "./funnel";
import { putGitHubBuffer } from "./github";

const OWNER_CHAT_ID = (process.env.OWNER_CHAT_ID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.use((ctx, next) => {
  const userId = String(ctx.from?.id ?? "");
  if (OWNER_CHAT_ID.length === 0) {
    return ctx.reply("Бот заблокирован: не задан OWNER_CHAT_ID.");
  }
  if (!OWNER_CHAT_ID.includes(userId)) {
    return ctx.reply("Доступ только для владельца.");
  }
  return next();
});

bot.on("text", async (ctx) => {
  const from = ctx.from;
  try {
    const path = await funnelToInbox({
      text: ctx.message.text,
      chatId: ctx.chat.id,
      fromId: from?.id,
      fromName: from?.username,
    });
    await ctx.reply(`Принято. Записал в ${path}`);
  } catch (err) {
    console.error("Funnel error", err);
    await ctx.reply(
      `Ошибка записи: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});

bot.on("document", async (ctx) => {
  const doc = ctx.message.document;
  if (!doc) return;
  try {
    const file = await ctx.telegram.getFile(doc.file_id);
    if (!file.file_path) throw new Error("file_path is missing");
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const buf = Buffer.from(res.data as any);
    const name = doc.file_name || `file-${Date.now()}`;
    await putGitHubBuffer(`Don'tReadMe/${name}`, buf, `Telegram: upload ${name}`);
    await ctx.reply(`Сохранено в Don'tReadMe/${name}`);
  } catch (err) {
    console.error("Upload error", err);
    await ctx.reply(
      `Ошибка загрузки: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});

// Кнопки (вопросы от HuckleberryFinn): формат callback_data "opt:<label>".
// Ответ владельца логируется в inbox как "Ответ кнопкой: <label>".
bot.action(/^opt:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.chat) return;
  const label = ctx.match[1];
  const from = ctx.from;
  try {
    const path = await funnelToInbox({
      text: `Ответ кнопкой: ${label}`,
      chatId: ctx.chat.id,
      fromId: from?.id,
      fromName: from?.username,
    });
    await ctx.reply(`Принято: ${label}`);
  } catch (err) {
    console.error("Button answer error", err);
    await ctx.reply(
      `Ошибка записи: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});

export default bot;
