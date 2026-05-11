import type { SendItem, SendPayload } from './types';
import { buildTelegramCaption, buildTelegramMessage, formatPriceLine } from './format';

type ParsedPhoto =
  | { kind: 'buffer'; buffer: Buffer; mime: string; ext: string }
  | { kind: 'url'; url: string };

type TgResponse = {
  ok: boolean;
  description?: string;
  parameters?: { retry_after?: number };
  result?: unknown;
};

const TG_API = 'https://api.telegram.org';
const MEDIA_GROUP_MAX = 10;

function getEnv(): { token: string; chatId: string } {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Server is not configured');
  }
  return { token, chatId };
}

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  return 'jpg';
}

function parseDataUrl(src: string): { buffer: Buffer; mime: string; ext: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/i.exec(src);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { buffer, mime, ext: mimeToExt(mime) };
}

async function fetchUrlToBuffer(
  url: string
): Promise<{ buffer: Buffer; mime: string; ext: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || 'image/jpeg';
    if (!mime.startsWith('image/')) return null;
    const ab = await res.arrayBuffer();
    return { buffer: Buffer.from(ab), mime, ext: mimeToExt(mime) };
  } catch {
    return null;
  }
}

async function parsePhoto(item: SendItem): Promise<ParsedPhoto> {
  if (item.src.startsWith('data:')) {
    const parsed = parseDataUrl(item.src);
    if (parsed) return { kind: 'buffer', ...parsed };
  }
  if (/^https?:\/\//i.test(item.src)) {
    const fetched = await fetchUrlToBuffer(item.src);
    if (fetched) return { kind: 'buffer', ...fetched };
    return { kind: 'url', url: item.src };
  }
  throw new Error('Unsupported photo source');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function tgFetch(method: string, body: FormData | string, isJson = false): Promise<TgResponse> {
  const { token } = getEnv();
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    body,
    headers,
  });
  return (await res.json()) as TgResponse;
}

async function tgCall(method: string, body: FormData | string, isJson = false): Promise<TgResponse> {
  let res = await tgFetch(method, body, isJson);
  if (!res.ok && res.parameters?.retry_after) {
    await sleep((res.parameters.retry_after + 1) * 1000);
    res = await tgFetch(method, body, isJson);
  }
  if (!res.ok) {
    throw new Error(`Telegram ${method}: ${res.description ?? 'unknown error'}`);
  }
  return res;
}

async function sendMessage(text: string): Promise<void> {
  const { chatId } = getEnv();
  await tgCall(
    'sendMessage',
    JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
    true
  );
}

async function sendSinglePhoto(photo: ParsedPhoto, caption: string): Promise<void> {
  const { chatId } = getEnv();
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }

  if (photo.kind === 'buffer') {
    form.append(
      'photo',
      new Blob([new Uint8Array(photo.buffer)], { type: photo.mime }),
      `photo.${photo.ext}`
    );
  } else {
    form.append('photo', photo.url);
  }

  await tgCall('sendPhoto', form);
}

async function sendMediaGroup(photos: ParsedPhoto[], caption: string): Promise<void> {
  const { chatId } = getEnv();
  const form = new FormData();
  form.append('chat_id', chatId);

  const media = photos.map((p, idx) => {
    const captionFields = idx === 0 && caption
      ? { caption, parse_mode: 'HTML' as const }
      : {};
    if (p.kind === 'buffer') {
      const field = `photo${idx}`;
      form.append(
        field,
        new Blob([new Uint8Array(p.buffer)], { type: p.mime }),
        `${field}.${p.ext}`
      );
      return { type: 'photo' as const, media: `attach://${field}`, ...captionFields };
    }
    return { type: 'photo' as const, media: p.url, ...captionFields };
  });

  form.append('media', JSON.stringify(media));
  await tgCall('sendMediaGroup', form);
}

export async function sendToTelegram(payload: SendPayload): Promise<void> {
  getEnv();

  const priceLine = formatPriceLine(payload.price);
  const { caption, overflow } = buildTelegramCaption({
    shortDesc: payload.shortDesc,
    longDesc: payload.longDesc,
    priceLine,
  });

  if (payload.items.length === 0) {
    const text = buildTelegramMessage({
      shortDesc: payload.shortDesc,
      longDesc: payload.longDesc,
      priceLine,
    });
    if (!text) throw new Error('Nothing to send');
    await sendMessage(text);
    return;
  }

  const photos: ParsedPhoto[] = [];
  for (const item of payload.items) {
    photos.push(await parsePhoto(item));
  }

  if (photos.length === 1) {
    await sendSinglePhoto(photos[0], caption);
    if (overflow) await sendMessage(overflow);
    return;
  }

  const chunks = chunk(photos, MEDIA_GROUP_MAX);
  for (let i = 0; i < chunks.length; i++) {
    const chunkCaption = i === 0 ? caption : '';
    await sendMediaGroup(chunks[i], chunkCaption);
    if (i < chunks.length - 1) await sleep(400);
  }
  if (overflow) await sendMessage(overflow);
}
