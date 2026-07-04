// src/bot.ts
import { Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import { handleMessage } from './archivist';
import { ConversationState } from './types';

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.catch((err, ctx) => {
  console.error('===== TELEGRAF ERROR =====');
  console.error(err);
  console.error('Context update:', ctx.update);
});

const conversations = new Map<number, ConversationState>();

function renderResponse(response: any, chatId: number) {
  const type = response.type || 'error';
  switch (type) {
    case 'ask':
      return {
        text: response.message,
        extra: {
          parse_mode: 'HTML'
        },
        nextState: response.nextState || { step: 'waiting_ceo_answer', data: {} }
      };
    case 'confirm':
      const confirmText = `
📝 <b>CEO принял решение:</b>

${response.message}

<b>Название:</b> ${response.decision.title}
<b>Папка:</b> ${response.decision.folder || 'не определена'}
<b>Тип:</b> ${response.decision.type}

${response.notePath ? `✅ Заметка сохранена: ${response.notePath}` : ''}

Сохранить?
`;
      return {
        text: confirmText,
        extra: {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('✅ Да', 'confirm_yes')],
            [Markup.button.callback('❌ Нет', 'confirm_no')]
          ])
        },
        nextState: response.nextState || { step: 'idle', data: {} }
      };
    case 'response':
      return {
        text: response.message,
        extra: { parse_mode: 'HTML' },
        nextState: response.nextState || { step: 'idle', data: {} }
      };
    case 'error':
      return {
        text: response.message,
        extra: { parse_mode: 'HTML' },
        nextState: response.nextState || { step: 'idle', data: {} }
      };
    default:
      return {
        text: '❌ Неизвестный ответ',
        extra: {},
        nextState: { step: 'idle', data: {} }
      };
  }
}

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const state = conversations.get(chatId) || { chatId, step: 'idle', data: {} };

  const response = await handleMessage(ctx.message.text, chatId, state);
  const rendered = renderResponse(response, chatId);

  // Обновляем состояние
  if (rendered.nextState) {
    conversations.set(chatId, { chatId, ...rendered.nextState });
  } else {
    conversations.set(chatId, { chatId, step: 'idle', data: {} });
  }

  // Отправляем ответ
  if (rendered.text) {
    await ctx.reply(rendered.text, rendered.extra || {});
  }
});

bot.action('confirm_yes', async (ctx) => {
  // TODO: реализовать сохранение
  await ctx.reply('✅ Сохранено');
});
bot.action('confirm_no', async (ctx) => {
  await ctx.reply('❌ Отменено');
});

export default bot;
