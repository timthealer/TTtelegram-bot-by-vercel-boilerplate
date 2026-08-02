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

// --- transliteration / slug for company-named folders ---
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  А: "a", Б: "b", В: "v", Г: "g", Д: "d", Е: "e", Ё: "e", Ж: "zh", З: "z",
  И: "i", Й: "y", К: "k", Л: "l", М: "m", Н: "n", О: "o", П: "p", Р: "r",
  С: "s", Т: "t", У: "u", Ф: "f", Х: "h", Ц: "c", Ч: "ch", Ш: "sh", Щ: "sch",
  Ъ: "", Ы: "y", Ь: "", Э: "e", Ю: "yu", Я: "ya",
};

function slugifyCompany(company: string): string {
  let s = company.replace(
    /\b(ООО|ОАО|ЗАО|АО|ИП|ТОО|PJSC|LLC|LTD|INC)\b/g,
    " "
  );
  s = s.replace(/«|»|"|'/g, " ");
  s = s
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("");
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "";
}

function parseIntro(text: string): { name: string; company: string } {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const companyRe = /\b(ООО|ОАО|ЗАО|АО|ИП|ТОО|PJSC|LLC|LTD|INC)\b/i;
  const isCompany = (p: string) => companyRe.test(p) || /[«»]/.test(p);
  const isPerson = (p: string) =>
    /^[А-ЯЁA-Z]/.test(p) && p.split(/\s+/).length <= 3 && !isCompany(p);

  let company = parts.find(isCompany) || "";
  let name = parts.find(isPerson) || "";
  if (!company && parts.length === 1 && !name) company = parts[0];
  if (!name && parts.length >= 2) {
    const other = parts.find((p) => !isCompany(p));
    if (other && /^[А-ЯЁA-Z]/.test(other)) name = other;
  }
  return { name, company };
}

function firstNameOf(name: string): string {
  const w = (name || "").trim().split(/\s+/)[0];
  return w || "Клиент";
}

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
  async function upsertClient(updated: any) {
    const clients = await getRegistry();
    const i = clients.findIndex((c: any) => c.chat_id === updated.chat_id);
    if (i >= 0) clients[i] = { ...clients[i], ...updated };
    else clients.push(updated);
    await saveRegistry(clients);
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
    const fn = firstNameOf(client.first_name || client.name);
    if (!slot) {
      await ctx.reply(
        `✅ Спасибо, ${fn}! Информация собрана. Мы подготовим аудит и предложения по автоматизации и свяжемся с вами.`
      );
      return;
    }
    const q = slot.type === "Q" ? BASE_QUESTIONS[slot.idx - 1] : FOLLOWUP_QUESTIONS[slot.idx - 1];
    const header =
      slot.type === "Q"
        ? `${fn}, вопрос ${slot.idx} из ${BASE_QUESTIONS.length}:`
        : `${fn}, уточняющий вопрос ${slot.idx}:`;
    await ctx.reply(`${header}\n${q.text}`, buildKeyboard(q, slot.type, slot.idx));
  }

  // --- introduction / onboarding ---
  async function saveProfile(client: any) {
    const existing = (await getGitHubFile(`clients/${client.slug}/profile.md`)) || "";
    if (existing) return;
    await putGitHubFile(
      `clients/${client.slug}/profile.md`,
      `# Клиент\n\n- **Имя:** ${client.name || "—"}\n- **Компания:** ${client.company || "—"}\n- **chat_id:** ${client.chat_id}\n- **создан:** ${client.created}\n`,
      `clients/${client.slug}: profile`
    );
  }

  async function startOnboarding(ctx: any, chatId: number) {
    await ctx.reply(
      "Здравствуйте! Давайте познакомимся.\n\nНапишите, пожалуйста, ваше имя и название компании, например: «Иван Петров, ООО Акваким»"
    );
  }

  async function finishIntro(ctx: any, chatId: number, text: string) {
    const { name, company } = parseIntro(text);
    const first_name = firstNameOf(name);

    if (!name && !company) {
      await ctx.reply(
        "Не совсем понял. Напишите, пожалуйста, имя и название компании, например: «Иван Петров, ООО Акваким»"
      );
      return;
    }

    if (!company) {
      await upsertClient({
        chat_id: chatId,
        slug: `client-${chatId}`,
        name,
        first_name,
        company: "",
        status: "need_company",
        created: new Date().toISOString().slice(0, 10),
      });
      await ctx.reply(
        `${first_name}, приятно познакомиться! Как называется ваша компания?`
      );
      return;
    }

    const slug = slugifyCompany(company) || `client-${chatId}`;
    const client = {
      chat_id: chatId,
      slug,
      name: name || company,
      first_name,
      company,
      status: "interview",
      created: new Date().toISOString().slice(0, 10),
    };
    await upsertClient(client);
    await saveProfile(client);
    await ctx.reply(
      `${first_name}, рад знакомству! Собрали: компания «${company}». Сбор информации займёт несколько минут. Отвечайте кнопками, текстом или голосовым сообщением.`
    );
    await askNext(client, ctx);
  }

  // --- handlers ---
  clientBot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;
    const client = await findClient(chatId);
    if (client && client.status === "interview" && (client.first_name || client.name)) {
      const fn = firstNameOf(client.first_name || client.name);
      await ctx.reply(`Здравствуйте, ${fn}! Продолжим сбор информации.`);
      await askNext(client, ctx);
    } else if (client && client.status === "need_company") {
      const fn = firstNameOf(client.first_name || client.name);
      await ctx.reply(`${fn}, приятно познакомиться! Как называется ваша компания?`);
    } else {
      await startOnboarding(ctx, chatId);
    }
  });

  clientBot.on("text", async (ctx) => {
    const chatId = ctx.chat.id;
    const client = await findClient(chatId);
    const text = ctx.message.text.trim();
    if (!text) return;

    if (!client) {
      await finishIntro(ctx, chatId, text);
      return;
    }

    if (client.status === "need_company") {
      const company = text;
      const slug = slugifyCompany(company) || `client-${chatId}`;
      const updated = { ...client, company, slug, status: "interview" as string };
      await upsertClient(updated);
      await saveProfile(updated);
      const fn = firstNameOf(updated.first_name || updated.name);
      await ctx.reply(
        `Отлично, ${fn}! Компания «${company}». Начнём сбор информации.`
      );
      await askNext(updated, ctx);
      return;
    }

    const slot = await nextSlot(client);
    if (!slot) {
      await ctx.reply("Вопросы закончены. Спасибо!");
      return;
    }
    await recordAnswer(client, slot.type, slot.idx, text);
    await ctx.reply("Принято.");
    await askNext(client, ctx);
  });

  clientBot.on("voice", async (ctx) => {
    const client = await findClient(ctx.chat.id);
    if (!client || client.status !== "interview") {
      await ctx.reply("Здравствуйте! Для начала представьтесь: имя и название компании.");
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
    if (!client || client.status !== "interview") {
      await ctx.reply("Пожалуйста, начните с /start и представьтесь.");
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
    const fn = firstNameOf(client.first_name || client.name);
    await ctx.reply(`Принято, ${fn}: ${label}`);
    await askNext(client, ctx);
  });

  return clientBot;
}
