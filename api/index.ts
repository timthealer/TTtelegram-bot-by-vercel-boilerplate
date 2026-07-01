import { Telegraf } from 'telegraf';
import axios from 'axios';
import { VercelRequest, VercelResponse } from '@vercel/node';

// Переменные окружения (Vercel подхватит их автоматически)
const BOT_TOKEN = process.env.BOT_TOKEN!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_OWNER = 'timthealer';
const GITHUB_REPO = 'TOS';

const bot = new Telegraf(BOT_TOKEN);

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const chatId = ctx.chat.id;

  try {
    const folder = await classifyWithGemini(text);
    const now = new Date();
    const fileName = now.toISOString().slice(0, 19).replace(/:/g, '-') + '.md';
    const noteContent = `---
type: задача
title: ${text.slice(0, 50)}
status: активна
tags: [${folder}]
created: ${now.toISOString().slice(0, 10)}
source: telegram
---

${text}`;

    await createGitHubFile(folder, fileName, noteContent);
    await ctx.reply(`✅ Заметка сохранена: ${folder}/${fileName}`);
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ошибка при обработке сообщения.');
  }
});

async function classifyWithGemini(text: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{
      parts: [{
        text: `Ты — классификатор. Определи папку для сообщения: 00_CEO, 01_Фермы, 10_Agents, 12_Inbox. Ответь только названием папки. Сообщение: ${text}`
      }]
    }]
  };
  const response = await axios.post(url, payload);
  const folder = response.data.candidates[0].content.parts[0].text.trim();
  const valid = ['00_CEO', '01_Фермы', '10_Agents', '12_Inbox'];
  return valid.includes(folder) ? folder : '12_Inbox';
}

async function createGitHubFile(folder: string, fileName: string, content: string) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}/${fileName}`;
  const encodedContent = Buffer.from(content).toString('base64');
  const payload = {
    message: `Добавлено из Telegram: ${fileName}`,
    content: encodedContent,
    branch: 'master'
  };
  await axios.put(url, payload, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

// Экспорт для Vercel (webhook)
export default async function handle(req: VercelRequest, res: VercelResponse) {
  await bot.webhookCallback('/api/webhook')(req, res);
}
