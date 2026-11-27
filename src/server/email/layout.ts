/**
 * Minimal e-mail layout: one structure rendered twice, as HTML (inline styles,
 * table layout for old clients) and as plain text. Every dynamic value is
 * escaped; nothing here trusts its input.
 */

export type Block =
  | { type: 'p'; text: string }
  | { type: 'details'; rows: Array<[label: string, value: string]> }
  | { type: 'button'; href: string; label: string }
  | { type: 'note'; text: string }

export type EmailContent = {
  subject: string
  /** Hidden preview line shown by inbox apps. */
  preheader: string
  heading: string
  blocks: Block[]
}

export type RenderedEmail = { subject: string; html: string; text: string }

const C = {
  cream: '#fbf6ee',
  card: '#fffdf8',
  line: '#e3d3bc',
  espresso: '#2b1d14',
  brown: '#6b5444',
  goldText: '#7a5a12',
  gold: '#f2b705',
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only absolute http(s) links reach an href. */
function safeHref(href: string): string {
  const url = new URL(href)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('unsafe link')
  return escapeHtml(url.toString())
}

const FONT = "Georgia, 'Times New Roman', serif"
const SANS = "'Helvetica Neue', Arial, sans-serif"

function blockHtml(block: Block): string {
  switch (block.type) {
    case 'p':
      return `<p style="margin:0 0 16px;font:16px/1.6 ${SANS};color:${C.brown}">${escapeHtml(block.text)}</p>`
    case 'note':
      return `<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${C.gold};background:${C.cream};font:14px/1.6 ${SANS};color:${C.brown}">${escapeHtml(block.text)}</p>`
    case 'button':
      return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${C.gold}"><a href="${safeHref(block.href)}" style="display:inline-block;padding:14px 32px;font:600 13px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${C.espresso};text-decoration:none">${escapeHtml(block.label)}</a></td></tr></table>`
    case 'details':
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-top:1px solid ${C.line}">${block.rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid ${C.line};font:12px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${C.goldText};vertical-align:top;width:38%">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid ${C.line};font:15px/1.5 ${SANS};color:${C.espresso}">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`,
        )
        .join('')}</table>`
  }
}

function blockText(block: Block): string {
  switch (block.type) {
    case 'p':
      return block.text
    case 'note':
      return `> ${block.text}`
    case 'button':
      return `${block.label}: ${block.href}`
    case 'details':
      return block.rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  }
}

const FOOTER = 'Luísa Silva Ramos · Maquiadora Profissional · São Paulo'

export function renderEmail(content: EmailContent): RenderedEmail {
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.cream}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">
<tr><td style="padding:0 0 20px;text-align:center;font:500 12px/1 ${SANS};letter-spacing:.28em;text-transform:uppercase;color:${C.goldText}">Luísa Silva Ramos</td></tr>
<tr><td style="padding:36px 32px;background:${C.card};border:1px solid ${C.line};border-radius:20px">
<h1 style="margin:0 0 20px;font:300 30px/1.15 ${FONT};color:${C.espresso}">${escapeHtml(content.heading)}</h1>
${content.blocks.map(blockHtml).join('\n')}
</td></tr>
<tr><td style="padding:20px 8px 0;text-align:center;font:12px/1.6 ${SANS};color:${C.brown}">${escapeHtml(FOOTER)}</td></tr>
</table></td></tr></table>
</body></html>`
  const text = [
    content.heading,
    '',
    ...content.blocks.map(blockText).join('\n\n').split('\n'),
    '',
    '—',
    FOOTER,
  ].join('\n')
  return { subject: content.subject, html, text }
}
