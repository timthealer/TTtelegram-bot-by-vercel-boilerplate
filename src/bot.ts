import { Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import { handleMessage } from './archivist';
import { ConversationState } from './types';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const conversations = new Map<number, ConversationState>();

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const state = conversations.get(chatId) || { chatId, step: 'idle', data: null };

  const response = await handleMessage(ctx.message.text, chatId, state);

  if (response.type === 'ask') {
    conversations.set(chatId, { ...state, step: 'waiting_ceo_decision', data: response });
    await ctx.reply(response.message);
  } else if (response.type === 'confirm') {
    const confirmText = `
📝 <b>CEO принял решение:</b>

${response.message}

<b>Название:</b> ${response.decision.title}
<b>Папка:</b> ${response.decision.folder || 'не определена'}
<b>Тип:</b> ${response.decision.type}

${response.notePath ? `✅ Заметка сохранена: ${response.notePath}` : ''}

Сохранить?
`;
    await ctx.replyWithHTML(confirmText, Markup.inlineKeyboard([
      [Markup.button.callback('✅ Да', 'confirm_yes')],
      [Markup.button.callback('❌ Нет', 'confirm_no')]
    ]));
  } else {
    await ctx.reply('❌ Неизвестный ответ');
  }
});

bot.action('confirm_yes', async (ctx) => {
  await ctx.reply('✅ Сохранено');
});
bot.action('confirm_no', async (ctx) => {
  await ctx.reply('❌ Отменено');
});

export default bot;
