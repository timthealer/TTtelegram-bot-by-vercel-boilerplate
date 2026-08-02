import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClientBot } from "../src/client";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.CLIENT_BOT_TOKEN) {
    res.status(500).send("CLIENT_BOT_TOKEN is not set");
    return;
  }
  const clientBot = createClientBot();
  return clientBot.webhookCallback("/api/client")(req, res);
}
