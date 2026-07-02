import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import { VercelRequest, VercelResponse } from '@vercel/node';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_OWNER = 'timthealer';
const GITHUB_REPO = 'TOS';
const BRANCH = 'master';

const bot = new Telegraf(BOT_TOKEN);

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

bot.on('text', async (ctx) => {
  const rawText = ctx.message.text;
  try {
    // Читаем индекс (пока не используется, но оставим для будущих шагов)
    const indexContent = await getGitHubFile('Document_Index.md') || 'Индекс пока пуст.';

    // Экранируем текст для безопасной вставки в промпт
    const safeText = JSON.stringify(rawText);

    const prompt = `
Ты — Архивариус TOS. Твоя задача — проанализировать сообщение пользователя и вернуть строгий JSON без пояснений.

Формат ответа:
{
  "title": "краткий заголовок до 5 слов",
  "folder": "одна из папок: 00_CEO, 01_Фермы, 02_Вода, 03_Микронизация, 04_Финансы, 05_Лодка, 06_Люди, 07_Идеи, 08_Задачи, 09_Дневник, 10_Agents, 11_Canvases, 12_Inbox, 13_Архив",
  "type": "тип: идея, задача, решение, проект, человек, факт, инструкция",
  "tags": ["тег1", "тег2", "тег3"],
  "summary": "краткое описание (одно предложение)",
  "note": "полный текст сообщения пользователя"
}

Правила:
- Всегда возвращай только JSON, без markdown, без пояснений.
- Если не уверен в папке или типе — выбери наиболее вероятное.
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

    // ВРЕМЕННО: выводим JSON для проверки
    await ctx.reply(`📋 Получен JSON:\n\`\`\`json\n${JSON.stringify(decision, null, 2)}\n\`\`\``);
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Ответ Gemini:', error.response.data);
    }
    await ctx.reply('❌ Ошибка при обработке.');
  }
});

export async function startVercel(req: VercelRequest, res: VercelResponse) {
  await bot.webhookCallback('/webhook')(req, res);
}

if (process.env.NODE_ENV !== 'production') {
  bot.launch();
  console.log('Bot is running locally...');
}
