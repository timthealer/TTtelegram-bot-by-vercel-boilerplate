import { Telegraf, Markup } from "telegraf";
import { handleMessage } from "./archivist";
import { ConversationState } from "./types";

const bot = new Telegraf(process.env.BOT_TOKEN!);

const conversations = new Map<number, ConversationState>();

bot.catch((err, ctx) => {
  console.error("===== TELEGRAF ERROR =====");
  console.error(err);
  console.error("Context update:", ctx.update);
});

function renderResponse(response: any) {
  switch (response.type) {
    case "ask": {
      const buttons =
        response.buttons?.map((b: any) => [
          Markup.button.callback(b.text, `answer:${b.value}`)
        ]) || [];

      return {
        text: response.message,
        extra: {
          parse_mode: "HTML",
          reply_markup:
            buttons.length > 0
              ? Markup.inlineKeyboard(buttons).reply_markup
              : undefined
        },
        nextState:
          response.nextState || {
            step: "waiting_ceo_answer",
            data: {}
          }
      };
    }

    case "confirm": {
      return {
        text: `✅ ${response.message}

📁 ${response.notePath || ""}`,
        extra: {
          parse_mode: "HTML"
        },
        nextState: {
          step: "idle",
          data: {}
        }
      };
    }

    case "response": {
      return {
        text: response.message,
        extra: {},
        nextState: {
          step: "idle",
          data: {}
        }
      };
    }

    default:
      return {
        text: response.message || "Ошибка",
        extra: {},
        nextState: {
          step: "idle",
          data: {}
        }
      };
  }
}

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;

  const state =
    conversations.get(chatId) || {
      chatId,
      step: "idle",
      data: {}
    };

  const response = await handleMessage(
    ctx.message.text,
    chatId,
    state
  );

  const rendered = renderResponse(response);

  conversations.set(chatId, {
    chatId,
    ...rendered.nextState
  });

  await ctx.reply(rendered.text, rendered.extra);
});

bot.action(/^answer:(.+)$/, async (ctx) => {
  const chatId = ctx.chat!.id;
  const answer = ctx.match[1];

  await ctx.answerCbQuery();

  const state =
    conversations.get(chatId) || {
      chatId,
      step: "idle",
      data: {}
    };

  const response = await handleMessage(
    answer,
    chatId,
    state
  );

  const rendered = renderResponse(response);

  conversations.set(chatId, {
    chatId,
    ...rendered.nextState
  });

  await ctx.reply(rendered.text, rendered.extra);
});

export default bot;
