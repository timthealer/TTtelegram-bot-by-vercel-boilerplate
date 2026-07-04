import { VercelRequest, VercelResponse } from "@vercel/node";
import bot from "../src/bot";

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    return bot.webhookCallback("/api/webhook")(req, res);
}
