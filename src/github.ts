import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_OWNER = 'timthealer';
const GITHUB_REPO = 'TT3Dato';
const BRANCH = 'master';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestWithRetry(fn: () => Promise<any>, attempts = 3): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e.response?.status;
      const retriable =
        status === 429 || status === 403 || status === 500 || status === 502 || status === 503;
      if (!retriable || i === attempts - 1) throw e;
      await sleep(500 * Math.pow(2, i));
    }
  }
  throw new Error('unreachable');
}

export async function getGitHubFile(path: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
    const res = await requestWithRetry(() =>
      axios.get(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
      })
    );
    return Buffer.from(res.data.content, 'base64').toString('utf-8');
  } catch (e: any) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}

export async function putGitHubFile(path: string, content: string, commitMsg: string) {
  await putGitHubBuffer(path, Buffer.from(content, 'utf-8'), commitMsg);
}

export async function putGitHubBuffer(path: string, content: Buffer, commitMsg: string) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const encoded = content.toString('base64');
  let sha: string | undefined;
  try {
    const existing = await requestWithRetry(() =>
      axios.get(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
      })
    );
    sha = existing.data.sha;
  } catch {}
  const payload: any = {
    message: commitMsg,
    content: encoded,
    branch: BRANCH,
  };
  if (sha) payload.sha = sha;
  await requestWithRetry(() =>
    axios.put(url, payload, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
  );
}
