export type SendItem = {
  src: string;
  name: string;
};

export const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type SizeOption = (typeof SIZE_OPTIONS)[number];

export type SendPayload = {
  shortDesc: string;
  longDesc: string;
  price: string;
  sizes: SizeOption[];
  items: SendItem[];
};

export type SendResult = { ok: true } | { ok: false; error: string };

const MAX_ITEMS = 50;
const MAX_TEXT = 8000;

const SIZE_SET = new Set<string>(SIZE_OPTIONS);

export function validatePayload(body: unknown): SendPayload | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const shortDesc = typeof b.shortDesc === 'string' ? b.shortDesc : '';
  const longDesc = typeof b.longDesc === 'string' ? b.longDesc : '';
  const price = typeof b.price === 'string' ? b.price : '';

  if (shortDesc.length > MAX_TEXT || longDesc.length > MAX_TEXT) return null;

  const rawSizes = Array.isArray(b.sizes) ? b.sizes : [];
  const seen = new Set<SizeOption>();
  for (const s of rawSizes) {
    if (typeof s !== 'string' || !SIZE_SET.has(s)) return null;
    seen.add(s as SizeOption);
  }
  const sizes: SizeOption[] = SIZE_OPTIONS.filter((s) => seen.has(s));

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

  return { shortDesc, longDesc, price, sizes, items };
}
