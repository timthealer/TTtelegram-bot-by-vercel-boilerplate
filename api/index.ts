import { VercelRequest, VercelResponse } from '@vercel/node';
import { startVercel } from '../src';

export default async function handle(req: VercelRequest, res: VercelResponse) {
  console.log('=== API FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('Path:', req.url);

  try {
    await startVercel(req, res);
  } catch (e: any) {
    console.error('Error in handle:', e.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>Server Error</h1><p>Sorry, there was a problem</p>');
  }
}
