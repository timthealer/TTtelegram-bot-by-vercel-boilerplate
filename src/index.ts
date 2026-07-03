import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { Markup } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_OWNER = 'timthealer';
const GITHUB_REPO = 'TOS';
const BRANCH = 'master';

const bot = new Telegraf(BOT_TOKEN);

// Хранилище временных решений
const pendingDecisions = new Map<number, any>();

// Список всех папок (для выбора при отказе)
const FOLDERS = [
  '00_CEO',
  '01_Фермы',
  '02_Вода',
  '03_Микронизация',
  '04_Финансы',
  '05_Лодка',
  '06_Люди',
  '07_Идеи',
  '08_Задачи',
  '09_Дневник',
  '10_Agents',
  '11_Canvases',
  '12_Inbox',
  '13_Архив'
];

async function getGitHubFile(path: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
    const res = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    return Buffer.from(res.data.content, 'base64').toString('utf-8');
  } catch (e: any) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}

async function putGitHubFile(path: string, content: string, commitMsg: string) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const encoded = Buffer.from(content, 'utf-8').toString('base64');
  let sha: string | undefined;
  try {
    const existing = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    sha = existing.data.sha;
  } catch {}
  const payload: any = {
    message: commitMsg,
    content: encoded,
    branch: BRANCH,
  };
  if (sha) payload.sha = sha;
  await axios.put(url, payload, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
}

// Функция для сохранения заметки (используется и для "Да", и для выбора папки)
async function saveNote(chatId: number, decision: any, folder?: string) {
  const targetFolder = folder || decision.folder;
  const title = decision.title || 'заметка';
  const fileName = title.replace(/[^a-zA-Zа-яА-Я0-9\s-]/g, '').trim().replace(/\s+/g, '_') + '.md';
  const filePath = `${targetFolder}/${fileName}`;

  const now = new Date();
  const frontmatter = `---
title: ${decision.title}
type: ${decision.type}
status: активна
project: ${decision.project || ''}
tags: [${decision.tags.join(', ')}]
created: ${now.toISOString().slice(0, 10)}
source: telegram
---
${decision.note}`;

  await putGitHubFile(filePath, frontmatter, `Добавлено из Telegram: ${decision.title}`);
  // TODO: обновление Document_Index (будет на Этапе 4)
  return filePath;
}

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const rawText = ctx.message.text;
  const chatId = ctx.chat.id;

  try {
    const safeText = JSON.stringify(rawText);

    const prompt = `
Ты — Архивариус TOS. Твоя задача — проанализировать сообщение пользователя и вернуть строгий JSON без пояснений.

Формат ответа:
{
  "title": "краткий заголовок до 5 слов",
  "folder": "одна из папок: 00_CEO, 01_Фермы, 02_Вода, 03_Микронизация, 04_Финансы, 05_Лодка, 06_Люди, 07_Идеи, 08_Задачи, 09_Дневник, 10_Agents, 11_Canvases, 12_Inbox, 13_Архив",
  "type": "тип: идея, задача, решение, проект, человек, факт, инструкция",
  "project": "если относится к проекту, иначе пустая строка",
  "tags": ["тег1", "тег2", "тег3"],
  "summary": "краткое описание (одно предложение)",
  "confidence": 0.95,
  "need_confirmation": false,
  "note": "полный текст сообщения пользователя"
}

Правила:
- Всегда возвращай только JSON, без markdown, без пояснений.
- Если не уверен в папке, типе или проекте — снижай confidence до 0.7–0.8.
- Если confidence < 0.9 — устанавливай need_confirmation: true.
- Заполняй все поля.

Сообщение пользователя: ${safeText}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
    });

    const raw = geminiRes.data.candidates[0].content.parts[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Не удалось извлечь JSON');
    const decision = JSON.parse(jsonMatch[0]);

    // Сохраняем решение
    pendingDecisions.set(chatId, decision);

    // Формируем HTML-сообщение с выделением "Кратко"
    const confirmText = `
📝 <b>Я понял так:</b>

<b>Название:</b> ${decision.title}
<b>Папка:</b> ${decision.folder}
<b>Тип:</b> ${decision.type}
<b>Проект:</b> ${decision.project || '—'}
<b>Теги:</b> ${decision.tags.join(', ')}
<b>Кратко:</b> <i>${decision.summary}</i>
<b>Уверенность:</b> ${Math.round(decision.confidence * 100)}%

Сохранить?
`;

    await ctx.replyWithHTML(confirmText, Markup.inlineKeyboard([
      [Markup.button.callback('✅ Да', 'confirm_yes')],
      [Markup.button.callback('❌ Нет, выбрать папку', 'confirm_no')]
    ]));
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Ответ Gemini:', error.response.data);
    }
    await ctx.reply('❌ Ошибка при обработке.');
  }
});

// Обработчик "Да"
bot.action('confirm_yes', async (ctx) => {
  const chatId = ctx.chat.id;
  const decision = pendingDecisions.get(chatId);
  if (!decision) {
    await ctx.reply('❌ Не найдено решение для подтверждения.');
    return;
  }

  try {
    const filePath = await saveNote(chatId, decision);
    pendingDecisions.delete(chatId);
    await ctx.reply(`✅ Заметка сохранена: ${filePath}`);
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ошибка при сохранении.');
  }
});

// Обработчик "Нет" — показывает список папок
bot.action('confirm_no', async (ctx) => {
  const chatId = ctx.chat.id;
  const decision = pendingDecisions.get(chatId);
  if (!decision) {
    await ctx.reply('❌ Не найдено решение для подтверждения.');
    return;
  }

  // Создаём inline-кнопки для каждой папки (по 2 в ряд)
  const folderButtons = FOLDERS.map(f => Markup.button.callback(f, `folder_${f}`));
  const rows = [];
  for (let i = 0; i < folderButtons.length; i += 2) {
    rows.push(folderButtons.slice(i, i + 2));
  }

  await ctx.reply('Выберите папку для сохранения:', Markup.inlineKeyboard(rows));
  await ctx.answerCbQuery();
});

// Обработчик выбора папки
bot.action(/folder_(.+)/, async (ctx) => {
  const chatId = ctx.chat.id;
  const selectedFolder = ctx.match[1];
  const decision = pendingDecisions.get(chatId);
  if (!decision) {
    await ctx.reply('❌ Не найдено решение для подтверждения.');
    return;
  }

  try {
    // Сохраняем с выбранной папкой
    const filePath = await saveNote(chatId, decision, selectedFolder);
    pendingDecisions.delete(chatId);
    await ctx.reply(`✅ Заметка сохранена в папку ${selectedFolder}: ${filePath}`);
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ошибка при сохранении.');
  }
});

export async function startVercel(req: VercelRequest, res: VercelResponse) {
  await bot.webhookCallback('/api/webhook')(req, res);
}
