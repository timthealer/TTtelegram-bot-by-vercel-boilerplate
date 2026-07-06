// src/bot.ts

import { Telegraf, Markup } from "telegraf";
import { handleMessage } from "./archivist";
import { ConversationState } from "./types";

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.catch((err, ctx) => {
  console.error("===== TELEGRAF ERROR =====");
  console.error(err);
  console.error("Context update:", ctx.update);
});

const conversations = new Map<number, ConversationState>();

function renderResponse(response: any) {
  switch (response.type) {
    case "ask": {
      let keyboard = undefined;

      if (response.question?.buttons?.length) {
        keyboard = Markup.inlineKeyboard(
          response.question.buttons.map((b: any) => [
            Markup.button.callback(b.text, b.id),
          ])
        );
      }

      return {
        text: response.message,
        extra: {
          parse_mode: "HTML",
          reply_markup: keyboard?.reply_markup,
        },
        nextState: response.nextState,
      };
    }

    case "confirm": {
      return {
        text: `📝 <b>CEO принял решение</b>

${response.message}

<b>Название:</b> ${response.decision.title}
<b>Папка:</b> ${response.decision.folder || "не определена"}
<b>Тип:</b> ${response.decision.type}

${response.notePath ? "✅ Заметка сохранена" : ""}`,
        extra: {
          parse_mode: "HTML",
        },
        nextState: response.nextState,
      };
    }

    case "response":
      return {
        text: response.message,
        extra: {
          parse_mode: "HTML",
        },
        nextState: response.nextState,
      };

    default:
      return {
        text: response.message || "Ошибка",
        extra: {},
        nextState: {
          step: "idle",
          data: {},
        },
      };
  }
}

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;

  const state =
    conversations.get(chatId) || {
      chatId,
      step: "idle",
      data: {},
    };

  const response = await handleMessage(
    ctx.message.text,
    chatId,
    state
  );

  const rendered = renderResponse(response);

  conversations.set(chatId, {
    chatId,
    ...(rendered.nextState || {
      step: "idle",
      data: {},
    }),
  });

  await ctx.reply(rendered.text, rendered.extra);
});

bot.on("callback_query", async (ctx) => {
  if (!("data" in ctx.callbackQuery)) return;

  const chatId = ctx.chat.id;
  const callback = ctx.callbackQuery.data;

  await ctx.answerCbQuery();

  const state =
    conversations.get(chatId) || {
      chatId,
      step: "idle",
      data: {},
    };

  const response = await handleMessage(
    callback,
    chatId,
    state
  );

  const rendered = renderResponse(response);

  conversations.set(chatId, {
    chatId,
    ...(rendered.nextState || {
      step: "idle",
      data: {},
    }),
  });

  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  await ctx.reply(rendered.text, rendered.extra);
});

export default bot;
