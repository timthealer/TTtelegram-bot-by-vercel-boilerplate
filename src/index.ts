import { VercelRequest, VercelResponse } from '@vercel/node';
import bot from './bot';

export async function startVercel(req: VercelRequest, res: VercelResponse) {
  await bot.webhookCallback('/api/webhook')(req, res);
}
