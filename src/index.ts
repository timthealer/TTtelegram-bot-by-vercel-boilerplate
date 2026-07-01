import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import { VercelRequest, VercelResponse } from '@vercel/node';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_OWNER = 'timthealer';
const GITHUB_REPO = 'TOS';
const BRANCH = 'master'; // если у тебя main — замени

const bot = new Telegraf(BOT_TOKEN);

// Вспомогательные функции
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

// Обработчик сообщений
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  try {
    // 1. Читаем Document_Index.md
    const indexContent = await getGitHubFile('Document_Index.md') || 'Индекс пока пуст.';

    // 2. Запрос к Gemini
    const prompt = `
Ты — Архивариус TOS.
Индекс заметок:
${indexContent}

Сообщение пользователя: "${text}"

Определи, к какой папке относится сообщение (00_CEO, 01_Фермы, 10_Agents, 12_Inbox) и придумай краткий заголовок.
Ответь ТОЛЬКО JSON:
{
  "folder": "одна_из_папок",
  "title": "заголовок"
}
`;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
    });
    const raw = geminiRes.data.candidates[0].content.parts[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Не удалось извлечь JSON');
    const decision = JSON.parse(jsonMatch[0]);

    const folder = decision.folder || '12_Inbox';
    const title = decision.title || text.slice(0, 50);

    // 3. Создаём заметку
    const now = new Date();
    const fileName = now.toISOString().slice(0, 19).replace(/:/g, '-') + '.md';
    const filePath = `${folder}/${fileName}`;
    const noteContent = `---
type: задача
title: ${title}
status: активна
tags: [${folder}]
created: ${now.toISOString().slice(0, 10)}
source: telegram
---
${text}`;
    await putGitHubFile(filePath, noteContent, `Добавлено из Telegram: ${title}`);

    // 4. Обновляем индекс
    const newIndex = `${indexContent}\n- title: "${title}"\n  folder: "${folder}"\n  file: "${filePath}"\n`;
    await putGitHubFile('Document_Index.md', newIndex, `Обновлён индекс: ${title}`);

    // 5. Ответ
    await ctx.reply(`✅ Заметка создана: ${filePath}`);
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ошибка при обработке.');
  }
});

// Экспорт для Vercel
export async function startVercel(req: VercelRequest, res: VercelResponse) {
  await bot.webhookCallback('/webhook')(req, res);
}

// Локальный запуск
if (process.env.NODE_ENV !== 'production') {
  bot.launch();
  console.log('Bot is running locally...');
}