export type SendItem = {
  src: string;
  name: string;
};

export type SendPayload = {
  shortDesc: string;
  longDesc: string;
  price: string;
  items: SendItem[];
};

export type SendResult = { ok: true } | { ok: false; error: string };

const MAX_ITEMS = 50;
const MAX_TEXT = 8000;

export function validatePayload(body: unknown): SendPayload | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const shortDesc = typeof b.shortDesc === 'string' ? b.shortDesc : '';
  const longDesc = typeof b.longDesc === 'string' ? b.longDesc : '';
  const price = typeof b.price === 'string' ? b.price : '';

  if (shortDesc.length > MAX_TEXT || longDesc.length > MAX_TEXT) return null;

  if (!Array.isArray(b.items)) return null;
  if (b.items.length > MAX_ITEMS) return null;

  const items: SendItem[] = [];
  for (const raw of b.items) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const src = typeof r.src === 'string' ? r.src : '';
    const name = typeof r.name === 'string' ? r.name : '';
    if (!src) return null;
    if (!src.startsWith('data:') && !/^https?:\/\//i.test(src)) return null;
    items.push({ src, name });
  }

  return { shortDesc, longDesc, price, items };
}
