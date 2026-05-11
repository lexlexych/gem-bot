import nodemailer from 'nodemailer';
import type { SendPayload } from './types';
import { formatPriceLine } from './format';
import { renderEmailHtml, renderEmailPlain } from './email-template';

type EmailEnv = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string[];
  subjectPrefix: string;
};

function getEnv(): EmailEnv {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;
  const toRaw = process.env.EMAIL_TO;

  if (!host || !portStr || !user || !pass || !from || !toRaw) {
    throw new Error('Server is not configured');
  }
  const port = Number(portStr);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('Server is not configured');
  }
  const secure = (process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false';
  const to = toRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) {
    throw new Error('Server is not configured');
  }
  const subjectPrefix = process.env.EMAIL_SUBJECT_PREFIX?.trim() || '';

  return { host, port, secure, user, pass, from, to, subjectPrefix };
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

type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
};

async function buildAttachments(payload: SendPayload): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (let i = 0; i < payload.items.length; i++) {
    const item = payload.items[i];
    let parsed: { buffer: Buffer; mime: string; ext: string } | null = null;
    if (item.src.startsWith('data:')) {
      parsed = parseDataUrl(item.src);
    } else if (/^https?:\/\//i.test(item.src)) {
      parsed = await fetchUrlToBuffer(item.src);
    }
    if (!parsed) continue;
    out.push({
      filename: `photo-${i + 1}.${parsed.ext}`,
      content: parsed.buffer,
      contentType: parsed.mime,
      cid: `photo-${i + 1}@velvet`,
    });
  }
  return out;
}

export async function sendEmail(payload: SendPayload): Promise<void> {
  const env = getEnv();

  const transporter = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.secure,
    auth: { user: env.user, pass: env.pass },
  });

  const attachments = await buildAttachments(payload);
  const photoCids = attachments.map((a) => a.cid);
  const priceLine = formatPriceLine(payload.price);

  const html = renderEmailHtml({
    shortDesc: payload.shortDesc,
    longDesc: payload.longDesc,
    priceLine,
    photoCids,
  });
  const text = renderEmailPlain({
    shortDesc: payload.shortDesc,
    longDesc: payload.longDesc,
    priceLine,
    photoCount: attachments.length,
  });

  const titlePart = payload.shortDesc.trim() || 'Новая карточка товара';
  const subject = env.subjectPrefix ? `${env.subjectPrefix} ${titlePart}`.trim() : titlePart;

  await transporter.sendMail({
    from: env.from,
    to: env.to,
    subject,
    text,
    html,
    attachments,
  });
}
