// src/client.ts
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import { getGitHubFile, putGitHubFile, putGitHubBuffer } from "./github";

const REGISTRY_PATH = "clients/registry.json";

interface Question {
  text: string;
  options: string[];
}

const BASE_QUESTIONS: Question[] = [
  {
    text: "Как называется ваша компания и чем она занимается?",
    options: ["Торговля / производство", "Услуги", "IT / разработка", "Розница"],
  },
  {
    text: "Сколько человек у вас работает?",
    options: ["1–5", "6–15", "16–50", "50+"],
  },
  {
    text: "Как давно компания на рынке?",
    options: ["До года", "1–3 года", "3–10 лет", "10+ лет"],
  },
  {
    text: "Какие процессы отнимают больше всего времени у вас или команды?",
    options: ["Документы / отчётность", "Переписка с клиентами", "Учёт / финансы", "Логистика / закупки"],
  },
  {
    text: "Что приходится делать вручную каждый день?",
    options: ["Заполнять таблицы / документы", "Переносить данные между программами", "Обрабатывать заявки", "Считать / сверять"],
  },
  {
    text: "Какие программы и сервисы вы используете в работе?",
    options: ["Excel / Google-таблицы", "CRM", "1С / бухгалтерия", "Мессенджеры / почта"],
  },
  {
    text: "Откуда приходят клиенты и заявки?",
    options: ["Сайт / лендинг", "Соцсети", "Сарафан / рекомендации", "Маркетплейсы"],
  },
  {
    text: "Как вы обрабатываете заявки?",
    options: ["Вручную в мессенджере", "Вручную в таблице", "Есть CRM", "Частично автоматизировано"],
  },
  {
    text: "Как ведёте учёт клиентов и сделок?",
    options: ["В голове / блокноте", "В Excel", "В CRM", "В 1С"],
  },
  {
    text: "Где чаще всего случаются ошибки или теряется время?",
    options: ["Дублирование данных", "Потерянные заявки", "Отчётность", "Согласования с людьми"],
  },
  {
    text: "Что вы автоматизировали бы в первую очередь?",
    options: ["Приём и обработку заявок", "Документы и отчёты", "Учёт и финансы", "Общение с клиентами"],
  },
  {
    text: "Какой главный результат вы хотите получить?",
    options: ["Сэкономить время", "Больше клиентов", "Порядок в данных", "Снизить ошибки"],
  },
];

const FOLLOWUP_QUESTIONS: Question[] = [
  {
    text: "Расскажите подробнее: как устроен ваш главный ручной процесс?",
    options: ["Таблицы", "Документы", "Люди / согласования", "Внешние сервисы"],
  },
  {
    text: "Какие объёмы можете назвать (заявки в день, количество документов)?",
    options: ["До 10", "10–50", "50–200", "200+"],
  },
  {
    text: "Есть ли у вас IT-специалист или подрядчик?",
    options: ["Свой специалист", "Внешний подрядчик", "Нет", "Пока не нужен"],
  },
  {
    text: "С какими внешними сервисами работаете (банки, маркетплейсы, госуслуги)?",
    options: ["Банки", "Маркетплейсы", "Госуслуги", "Другое"],
  },
  {
    text: "Какой бюджет примерно готовы выделить на автоматизацию?",
    options: ["До 100 тыс.", "100–300 тыс.", "300 тыс.–1 млн", "1 млн+"],
  },
  {
    text: "Кто будет принимать решение о внедрении?",
    options: ["Я сам", "Совет директоров", "Партнёры", "Собственник"],
  },
];

const MAX_TOTAL = 18;

export function createClientBot(): Telegraf {
  const token = process.env.CLIENT_BOT_TOKEN;
  if (!token) throw new Error("CLIENT_BOT_TOKEN is not set");
  const clientBot = new Telegraf(token);

  clientBot.catch((err, ctx) => {
    console.error("CLIENT BOT ERROR", err);
    console.error("Update:", ctx.update);
  });

  // --- registry ---
  async function getRegistry(): Promise<any[]> {
    const raw = await getGitHubFile(REGISTRY_PATH);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.clients) ? parsed.clients : [];
    } catch {
      return [];
    }
  }
  async function saveRegistry(clients: any[]) {
    await putGitHubFile(
      REGISTRY_PATH,
      JSON.stringify({ clients }, null, 2),
      "clients: registry update"
    );
  }
  async function findClient(chatId: number) {
    const clients = await getRegistry();
    return clients.find((c: any) => c.chat_id === chatId) || null;
  }

  // --- interview ---
  async function interviewLines(slug: string): Promise<string[]> {
    const raw = await getGitHubFile(`clients/${slug}/interview.md`);
    if (!raw) return [];
    return raw
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => /^\*\*(Q|F)\d+:/.test(l));
  }
  const isFollow = (l: string) => l.startsWith("**F");
  const baseDone = (lines: string[]) =>
    lines.filter((l) => !isFollow(l)).length >= BASE_QUESTIONS.length;
  const followCount = (lines: string[]) =>
    lines.filter((l) => isFollow(l)).length;
  const skippedBase = (lines: string[]) =>
    lines.filter((l) => /^\*\*Q\d+:.*(⏭|Не знаю)/.test(l)).length;

  function buildKeyboard(q: Question, type: string, idx: number) {
    const rows = q.options.map((opt, i) => [
      Markup.button.callback(opt, `ans:${type}${idx}:o${i}`),
    ]);
    rows.push([
      Markup.button.callback("✍️ Свой вариант", `ans:${type}${idx}:custom`),
      Markup.button.callback("🎤 Голосом", `ans:${type}${idx}:voice`),
    ]);
    rows.push([
      Markup.button.callback("Не знаю", `ans:${type}${idx}:dunno`),
      Markup.button.callback("⏭ Пропустить", `ans:${type}${idx}:skip`),
    ]);
    return Markup.inlineKeyboard(rows);
  }

  async function recordAnswer(
    client: any,
    type: string,
    idx: number,
    answer: string
  ) {
    const q = type === "Q" ? BASE_QUESTIONS[idx - 1] : FOLLOWUP_QUESTIONS[idx - 1];
    const existing = (await getGitHubFile(`clients/${client.slug}/interview.md`)) || "";
    const block = `**${type}${idx}: ${q.text}**\nОтвет: ${answer}\n\n`;
    await putGitHubFile(
      `clients/${client.slug}/interview.md`,
      `${existing}${block}`,
      `clients/${client.slug}: ${type}${idx} answer`
    );
  }

  async function nextSlot(client: any): Promise<{ type: string; idx: number } | null> {
    const lines = await interviewLines(client.slug);
    if (!baseDone(lines)) return { type: "Q", idx: lines.filter((l) => !isFollow(l)).length + 1 };
    if (
      skippedBase(lines) > 0 &&
      followCount(lines) < skippedBase(lines) &&
      lines.length < MAX_TOTAL
    ) {
      return { type: "F", idx: followCount(lines) + 1 };
    }
    return null;
  }

  async function askNext(client: any, ctx: any) {
    const slot = await nextSlot(client);
    if (!slot) {
      await ctx.reply(
        "✅ Спасибо! Информация собрана. Мы подготовим аудит и предложения по автоматизации и свяжемся с вами."
      );
      return;
    }
    const q = slot.type === "Q" ? BASE_QUESTIONS[slot.idx - 1] : FOLLOWUP_QUESTIONS[slot.idx - 1];
    const header =
      slot.type === "Q"
        ? `Вопрос ${slot.idx} из ${BASE_QUESTIONS.length}:`
        : `Уточняющий вопрос ${slot.idx}:`;
    await ctx.reply(`${header}\n${q.text}`, buildKeyboard(q, slot.type, slot.idx));
  }

  // --- handlers ---
  clientBot.command("start", async (ctx) => {
    const client = await findClient(ctx.chat.id);
    if (client) {
      await ctx.reply(`Здравствуйте, ${client.name}! Продолжим сбор информации.`);
      await askNext(client, ctx);
    } else {
      await ctx.reply(
        "Здравствуйте! Для начала напишите название компании и ваше имя, например: «ООО Акваким, Иван Петров»"
      );
    }
  });

  clientBot.on("text", async (ctx) => {
    const chatId = ctx.chat.id;
    const client = await findClient(chatId);
    if (!client) {
      const text = ctx.message.text.trim();
      if (!text) return;
      const slug = `client-${chatId}`;
      const newClient = {
        chat_id: chatId,
        slug,
        name: text,
        company: text,
        status: "interview",
        created: new Date().toISOString().slice(0, 10),
      };
      const clients = await getRegistry();
      clients.push(newClient);
      await saveRegistry(clients);
      await putGitHubFile(
        `clients/${slug}/profile.md`,
        `# Клиент\n\n- **Название:** ${text}\n- **chat_id:** ${chatId}\n- **создан:** ${newClient.created}\n`,
        `clients/${slug}: profile`
      );
      await ctx.reply(
        `Здравствуйте, «${text}»! Сбор информации займёт несколько минут. Отвечайте на вопросы, можно кнопками, текстом или голосовым сообщением.`
      );
      await askNext(newClient, ctx);
      return;
    }

    const slot = await nextSlot(client);
    if (!slot) {
      await ctx.reply("Вопросы закончены. Спасибо!");
      return;
    }
    await recordAnswer(client, slot.type, slot.idx, ctx.message.text);
    await ctx.reply("Принято.");
    await askNext(client, ctx);
  });

  clientBot.on("voice", async (ctx) => {
    const client = await findClient(ctx.chat.id);
    if (!client) {
      await ctx.reply("Здравствуйте! Для начала напишите название компании и ваше имя.");
      return;
    }
    try {
      const file = await ctx.telegram.getFile(ctx.message.voice.file_id);
      if (!file.file_path) throw new Error("file_path is missing");
      const url = `https://api.telegram.org/file/bot${process.env.CLIENT_BOT_TOKEN}/${file.file_path}`;
      const res = await axios.get(url, { responseType: "arraybuffer" });
      const buf = Buffer.from(res.data as any);
      const ts = Date.now();
      const audioPath = `clients/${client.slug}/voice/${ts}.ogg`;
      await putGitHubBuffer(audioPath, buf, `clients/${client.slug}: voice ${ts}`);
      const slot = await nextSlot(client);
      if (slot) {
        await recordAnswer(client, slot.type, slot.idx, `🎤 голосовой ответ → ${audioPath}`);
      }
      await ctx.reply("Голосовое сохранено.");
      await askNext(client, ctx);
    } catch (err) {
      console.error("Voice error", err);
      await ctx.reply("Не удалось сохранить голосовое. Попробуйте ещё раз.");
    }
  });

  clientBot.action(/^ans:(Q|F)(\d+):(o\d+|custom|voice|dunno|skip)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, type, idxStr, action] = ctx.match;
    const client = await findClient(ctx.from.id);
    if (!client) {
      await ctx.reply("Пожалуйста, начните с /start");
      return;
    }
    const idx = parseInt(idxStr, 10);
    const q = type === "Q" ? BASE_QUESTIONS[idx - 1] : FOLLOWUP_QUESTIONS[idx - 1];
    if (!q) {
      await ctx.reply("Вопрос не найден.");
      return;
    }
    if (action === "custom") {
      await ctx.reply("✍️ Напишите ваш ответ текстом:");
      return;
    }
    if (action === "voice") {
      await ctx.reply("🎤 Отправьте голосовое сообщение:");
      return;
    }
    const label =
      action === "skip"
        ? "⏭ Пропустить"
        : action === "dunno"
        ? "Не знаю"
        : q.options[parseInt(action.slice(1), 10)];
    await recordAnswer(client, type, idx, label);
    await ctx.reply(`Принято: ${label}`);
    await askNext(client, ctx);
  });

  return clientBot;
}
