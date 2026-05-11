import { escapeHtml } from './format';

export type EmailTemplateData = {
  shortDesc: string;
  longDesc: string;
  priceLine: string | null;
  sizes: readonly string[];
  photoCids: string[];
};

const COLOR_BG = '#f8f8f8';
const COLOR_SURFACE = '#ffffff';
const COLOR_TEXT = '#1f2937';
const COLOR_MUTED = '#6b7280';
const COLOR_BORDER = '#e5e7eb';
const COLOR_HEADER_BG = '#1f2937';
const COLOR_HEADER_SUB = '#cbd5e1';
const COLOR_PRICE_BG = '#fff7e6';
const COLOR_PRICE_TEXT = '#92400e';
const COLOR_PRICE_BORDER = '#fde68a';

function renderTitle(shortDesc: string): string {
  const safe = escapeHtml(shortDesc.trim());
  if (!safe) return '';
  return `
    <tr><td style="padding:28px 28px 0;">
      <h1 style="margin:0; font-size:22px; line-height:1.3; font-weight:700; color:${COLOR_TEXT}; letter-spacing:-0.01em;">
        ${safe}
      </h1>
    </td></tr>`;
}

function renderPrice(priceLine: string | null): string {
  if (!priceLine) return '';
  const safe = escapeHtml(priceLine);
  return `
    <tr><td style="padding:16px 28px 0;">
      <span style="display:inline-block; background:${COLOR_PRICE_BG}; color:${COLOR_PRICE_TEXT};
                   border:1px solid ${COLOR_PRICE_BORDER}; border-radius:999px; padding:8px 16px;
                   font-size:16px; font-weight:700; letter-spacing:0.01em;">
        ${safe}
      </span>
    </td></tr>`;
}

function renderSizes(sizes: readonly string[]): string {
  if (!sizes || sizes.length === 0) return '';
  const chips = sizes
    .map(
      (s) => `<span style="display:inline-block; padding:6px 12px; margin:0 6px 6px 0;
                   background:#f3f4f6; color:${COLOR_TEXT};
                   border:1px solid ${COLOR_BORDER}; border-radius:8px;
                   font-size:13px; font-weight:600; letter-spacing:0.03em;">${escapeHtml(s)}</span>`
    )
    .join('');
  return `
    <tr><td style="padding:18px 28px 0;">
      <div style="font-size:11px; color:${COLOR_MUTED}; text-transform:uppercase; letter-spacing:0.08em; font-weight:600; margin-bottom:8px;">
        Доступные размеры
      </div>
      <div>${chips}</div>
    </td></tr>`;
}

function renderLong(longDesc: string): string {
  const trimmed = longDesc.trim();
  if (!trimmed) return '';
  const html = escapeHtml(trimmed).replace(/\r?\n/g, '<br>');
  return `
    <tr><td style="padding:20px 28px 0;">
      <p style="margin:0; font-style:italic; color:#374151; font-size:15px; line-height:1.6;">
        ${html}
      </p>
    </td></tr>`;
}

function renderGallery(photoCids: string[]): string {
  if (photoCids.length === 0) return '';
  const imgs = photoCids
    .map(
      (cid) =>
        `<img src="cid:${cid}" alt="" width="270" style="width:48%; max-width:270px; height:auto; border-radius:8px; margin:1%; vertical-align:top; display:inline-block; border:0;" />`
    )
    .join('');
  return `
    <tr><td style="padding:24px 28px 8px;">
      <div style="font-size:0; line-height:0; text-align:left;">${imgs}</div>
    </td></tr>`;
}

export function renderEmailHtml(data: EmailTemplateData): string {
  const subtitle = data.shortDesc.trim()
    ? 'Новая карточка товара'
    : 'Карточка товара без названия';

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Velvet District</title>
</head>
<body style="margin:0; padding:0; background:${COLOR_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:${COLOR_TEXT}; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR_BG}; padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px; width:100%; background:${COLOR_SURFACE}; border-radius:14px; box-shadow:0 4px 16px rgba(17,24,39,0.08); overflow:hidden;">

        <tr><td style="background:${COLOR_HEADER_BG}; padding:22px 28px;">
          <div style="color:#ffffff; font-size:18px; font-weight:700; letter-spacing:0.12em;">VELVET DISTRICT</div>
          <div style="color:${COLOR_HEADER_SUB}; font-size:12px; margin-top:4px; letter-spacing:0.02em;">${escapeHtml(subtitle)}</div>
        </td></tr>

        ${renderTitle(data.shortDesc)}
        ${renderPrice(data.priceLine)}
        ${renderSizes(data.sizes)}
        ${renderLong(data.longDesc)}
        ${renderGallery(data.photoCids)}

        <tr><td style="border-top:1px solid ${COLOR_BORDER}; padding:18px 28px; color:${COLOR_MUTED}; font-size:12px; text-align:center;">
          Сообщение отправлено автоматически из приложения Velvet District.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderEmailPlain(data: Omit<EmailTemplateData, 'photoCids'> & { photoCount: number }): string {
  const lines: string[] = [];
  if (data.shortDesc.trim()) lines.push(data.shortDesc.trim());
  if (data.priceLine) {
    if (lines.length) lines.push('');
    lines.push(data.priceLine);
  }
  if (data.sizes && data.sizes.length > 0) {
    if (lines.length) lines.push('');
    lines.push(`Доступные размеры: ${data.sizes.join(', ')}`);
  }
  if (data.longDesc.trim()) {
    if (lines.length) lines.push('');
    lines.push(data.longDesc.trim());
  }
  if (data.photoCount > 0) {
    lines.push('');
    lines.push(`[Фото: ${data.photoCount}]`);
  }
  return lines.join('\n');
}
