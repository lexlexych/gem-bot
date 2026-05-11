export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPriceLine(price: string): string | null {
  const trimmed = (price ?? '').trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;

  const hasFraction = Math.abs(n - Math.trunc(n)) > 0.005;
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);

  return `${formatted} €`;
}

export type MessageParts = {
  shortDesc: string;
  longDesc: string;
  priceLine: string | null;
  sizes: readonly string[];
};

const TG_CAPTION_LIMIT = 1024;

function titleHtml(shortDesc: string): string {
  const t = shortDesc.trim();
  return t ? `<b>${escapeHtml(t)}</b>` : '';
}

function priceHtml(priceLine: string | null): string {
  return priceLine ? `💶 <b>${escapeHtml(priceLine)}</b>` : '';
}

function sizesHtml(sizes: readonly string[]): string {
  if (!sizes || sizes.length === 0) return '';
  const chips = sizes.map((s) => `<code>${escapeHtml(s)}</code>`).join(' · ');
  return `📐 <b>Размеры:</b> ${chips}`;
}

function longHtml(longDesc: string): string {
  const t = longDesc.trim();
  return t ? `<blockquote expandable>${escapeHtml(t)}</blockquote>` : '';
}

function composeText(parts: MessageParts, includeLong: boolean): string {
  const title = titleHtml(parts.shortDesc);
  const meta = [priceHtml(parts.priceLine), sizesHtml(parts.sizes)].filter(Boolean).join('\n');
  const long = includeLong ? longHtml(parts.longDesc) : '';
  return [title, meta, long].filter(Boolean).join('\n\n');
}

export function buildTelegramMessage(parts: MessageParts): string {
  return composeText(parts, true);
}

export function buildTelegramCaption(parts: MessageParts): {
  caption: string;
  overflow: string | null;
} {
  const full = composeText(parts, true);
  if (full.length <= TG_CAPTION_LIMIT) {
    return { caption: full, overflow: null };
  }

  const withoutLong = composeText(parts, false);
  const long = longHtml(parts.longDesc) || null;

  if (withoutLong.length <= TG_CAPTION_LIMIT) {
    return { caption: withoutLong, overflow: long };
  }

  return {
    caption: withoutLong.slice(0, TG_CAPTION_LIMIT - 1) + '…',
    overflow: long,
  };
}
