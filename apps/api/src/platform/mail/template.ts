// The look of every FigCit email: the app's cream page, a white card, the plum button and the
// Lora heading (with email-safe fallbacks), so a message feels like the app it came from.
// Email clients differ a lot: this uses tables and inline styles only, a hosted PNG logo (Gmail
// drops inline SVG), and always a plain-text twin. Nothing here is personal data.

/** The app's light theme (figcit-pwa src/styles/globals.css). */
const C = {
  page: '#f5eede',
  card: '#ffffff',
  ink: '#2b1d2a',
  muted: '#6f6370',
  line: '#e4d9c7',
  accent: '#5b3358',
  onAccent: '#ffffff',
  accentSoft: '#ede4ec',
} as const;

const SANS = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Lora, Georgia, 'Times New Roman', serif";

export interface EmailContent {
  /** The app's address: the logo and the footer link come from it. */
  readonly appUrl: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  /** The one main button. */
  readonly action?: { readonly label: string; readonly url: string } | undefined;
  /** A code to type in instead (sign-in), shown large and spaced. */
  readonly code?: { readonly label: string; readonly value: string } | undefined;
  /** The line inbox lists show next to the subject. */
  readonly preheader?: string | undefined;
  /** A quieter last line, e.g. "If you didn't ask for this, you can ignore this email." */
  readonly note?: string | undefined;
}

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const origin = (url: string): string => url.replace(/\/+$/, '');

function button(action: NonNullable<EmailContent['action']>): string {
  // A padded table cell is clickable in every client, Outlook included; the link fills it.
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px">
<tr><td style="border-radius:999px;background:${C.accent}">
<a href="${esc(action.url)}" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-size:17px;font-weight:600;line-height:1.2;color:${C.onAccent};text-decoration:none;border-radius:999px">${esc(action.label)}</a>
</td></tr></table>`;
}

function codeBox(code: NonNullable<EmailContent['code']>): string {
  return `<p style="margin:24px 0 8px;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.muted}">${esc(code.label)}</p>
<p style="margin:0 0 8px;padding:14px 18px;border-radius:14px;background:${C.accentSoft};font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:${C.accent};text-align:center">${esc(code.value)}</p>`;
}

/** The HTML and the plain-text versions of one email. */
export function emailLayout(m: EmailContent): { html: string; text: string } {
  const app = origin(m.appUrl);
  const text = [
    m.heading,
    '',
    ...m.paragraphs.flatMap((p) => [p, '']),
    ...(m.action ? [`${m.action.label}: ${m.action.url}`, ''] : []),
    ...(m.code ? [`${m.code.label} ${m.code.value}`, ''] : []),
    ...(m.note ? [m.note, ''] : []),
    'FigCit',
    app,
  ].join('\n');
  const para = (p: string): string =>
    `<p style="margin:0 0 16px;font-family:${SANS};font-size:17px;line-height:1.6;color:${C.ink}">${esc(p)}</p>`;
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(m.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
${m.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(m.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.page}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">
<tr><td style="padding:0 8px 20px">
<a href="${esc(app)}/" style="text-decoration:none;color:${C.accent}">
<img src="${esc(app)}/icons/icon-192.png" width="40" height="40" alt="" style="vertical-align:middle;border:0;border-radius:10px">
<span style="vertical-align:middle;padding-left:10px;font-family:${SERIF};font-size:22px;font-weight:700;color:${C.accent}">FigCit</span>
</a>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:24px;padding:36px 32px">
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:26px;font-weight:700;line-height:1.3;color:${C.ink}">${esc(m.heading)}</h1>
${m.paragraphs.map(para).join('\n')}
${m.action ? button(m.action) : ''}
${m.code ? codeBox(m.code) : ''}
${m.note ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${C.line};font-family:${SANS};font-size:15px;line-height:1.6;color:${C.muted}">${esc(m.note)}</p>` : ''}
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
FigCit, by Figcit Ltd · <a href="${esc(app)}/" style="color:${C.muted}">${esc(app.replace(/^https?:\/\//, ''))}</a><br>
Need help right now? Open FigCit and tap Help, or call 999 in an emergency.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { html, text };
}
