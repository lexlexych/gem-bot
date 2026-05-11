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

export type CaptionParts = {
  shortDesc: string;
  longDesc: string;
  priceLine: string | null;
};

const TG_CAPTION_LIMIT = 1024;

export function buildTelegramCaption(parts: CaptionParts): {
  caption: string;
  overflow: string | null;
} {
  const { shortDesc, longDesc, priceLine } = parts;

  const titleHtml = shortDesc.trim() ? `<b>${escapeHtml(shortDesc.trim())}</b>` : '';
  const priceHtml = priceLine ? escapeHtml(priceLine) : '';
  const longHtml = longDesc.trim() ? `<i>${escapeHtml(longDesc.trim())}</i>` : '';

  const fullParts = [titleHtml, priceHtml, longHtml].filter(Boolean);
  const full = fullParts.join('\n');

  if (full.length <= TG_CAPTION_LIMIT) {
    return { caption: full, overflow: null };
  }

  const minParts = [titleHtml, priceHtml].filter(Boolean);
  const minCaption = minParts.join('\n');

  if (minCaption.length <= TG_CAPTION_LIMIT) {
    return { caption: minCaption, overflow: longHtml || null };
  }

  return {
    caption: minCaption.slice(0, TG_CAPTION_LIMIT - 1) + '…',
    overflow: longHtml || null,
  };
}

export function buildTelegramMessage(parts: CaptionParts): string {
  const { shortDesc, longDesc, priceLine } = parts;
  const out: string[] = [];
  if (shortDesc.trim()) out.push(`<b>${escapeHtml(shortDesc.trim())}</b>`);
  if (priceLine) out.push(escapeHtml(priceLine));
  if (longDesc.trim()) out.push(`<i>${escapeHtml(longDesc.trim())}</i>`);
  return out.join('\n');
}
