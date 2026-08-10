// Shared Brevo sender and branded email layout.
// Filenames starting with _ are not routed by Vercel, so this stays a helper.
//
// Brand: navy #1e3b57 · rose #c07481 · cream #f5f2ee · ink #0c1c2c
// Web fonts do not load reliably in email clients, so Georgia carries the
// Fraunces role and a sans stack carries the Syne role.

const NAVY = '#1e3b57';
const ROSE = '#c07481';
const CREAM = '#f5f2ee';
const INK = '#0c1c2c';
const PAPER = '#ede9e3';

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escMultiline = (v) => esc(v).replace(/\r?\n/g, '<br>');

/**
 * Renders a labelled detail table.
 * @param {Array<[string,string]>} pairs [label, value]
 */
function detailRows(pairs) {
  return pairs
    .map(
      ([label, value], i) => `
            <tr>
              <td style="padding:${i === 0 ? '0' : '14px'} 0 0;border-top:${
                i === 0 ? 'none' : '1px solid rgba(30,59,87,0.10)'
              };${i === 0 ? '' : 'padding-top:14px;'}">
                <div style="font-family:${SANS};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${ROSE};padding-bottom:5px;">${esc(
                  label
                )}</div>
                <div style="font-family:${SERIF};font-size:15px;line-height:1.65;color:${INK};padding-bottom:14px;">${escMultiline(
                  value
                )}</div>
              </td>
            </tr>`
    )
    .join('');
}

/**
 * Wraps content in the branded shell.
 * @param {{eyebrow:string, heading:string, body:string, preheader?:string, footerNote?:string}} o
 */
function layout({ eyebrow, heading, body, preheader = '', footerNote = '' }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">

      <tr><td style="background:${INK};padding:26px 34px;">
        <div style="font-family:${SANS};font-size:15px;font-weight:bold;letter-spacing:1px;color:${CREAM};">
          DakJen <span style="color:${ROSE};">Creative</span>
        </div>
      </td></tr>
      <tr><td style="height:3px;background:${ROSE};font-size:0;line-height:0;">&nbsp;</td></tr>

      <tr><td style="background:#ffffff;padding:38px 34px 34px;">
        <div style="font-family:${SANS};font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:${ROSE};padding-bottom:14px;">${esc(
          eyebrow
        )}</div>
        <h1 style="margin:0 0 22px;font-family:${SANS};font-size:23px;line-height:1.25;font-weight:600;color:${NAVY};">${esc(
          heading
        )}</h1>
        ${body}
      </td></tr>

      <tr><td style="background:${NAVY};padding:22px 34px;">
        <div style="font-family:${SERIF};font-size:12px;line-height:1.7;color:rgba(245,242,238,0.62);">
          ${footerNote ? escMultiline(footerNote) + '<br><br>' : ''}
          DakJen Creative LLC · New York, NY · Baltimore, MD<br>
          <a href="https://dakjencreative.com" style="color:${ROSE};text-decoration:none;">dakjencreative.com</a>
          &nbsp;·&nbsp;
          <a href="mailto:business@dakjencreative.com" style="color:${ROSE};text-decoration:none;">business@dakjencreative.com</a>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Body paragraph in the brand serif. */
const para = (text) =>
  `<p style="margin:0 0 16px;font-family:${SERIF};font-size:16px;line-height:1.75;color:${INK};">${text}</p>`;

/** Rose-ruled detail block. */
const detailBlock = (pairs) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
     style="border-left:3px solid ${ROSE};padding-left:18px;margin:6px 0 4px;">
     ${detailRows(pairs)}
   </table>`;

/** Solid brand button. */
const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;"><tr>
     <td style="background:${ROSE};">
       <a href="${href}" style="display:inline-block;padding:13px 28px;font-family:${SANS};font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${esc(
         label
       )}</a>
     </td></tr></table>`;

/**
 * A stack of "here's where to find us" links.
 * @param {Array<{href:string,label:string,note:string}>} items
 */
const linkList = (items) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">` +
  items
    .map(
      (it, i) => `
      <tr><td style="padding:14px 0;${
        i === 0 ? '' : 'border-top:1px solid rgba(30,59,87,0.10);'
      }">
        <a href="${it.href}" style="font-family:${SANS};font-size:15px;font-weight:600;color:${NAVY};text-decoration:none;">
          ${esc(it.label)} <span style="color:${ROSE};">&rarr;</span>
        </a>
        <div style="font-family:${SERIF};font-size:14px;line-height:1.6;color:#5b6672;padding-top:4px;">${esc(
          it.note
        )}</div>
      </td></tr>`
    )
    .join('') +
  `</table>`;

/**
 * Stacked proof stats. Figures stay attributed to the campaign that produced
 * them — never phrased as a capability guarantee.
 * @param {Array<{figure:string,note:string}>} items
 */
const statList = (items) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};margin:6px 0 4px;">` +
  items
    .map(
      (it, i) => `
      <tr><td style="padding:16px 20px;${
        i === 0 ? '' : 'border-top:1px solid rgba(30,59,87,0.10);'
      }">
        <div style="font-family:${SANS};font-size:26px;font-weight:600;line-height:1;color:${ROSE};padding-bottom:6px;">${esc(
          it.figure
        )}</div>
        <div style="font-family:${SERIF};font-size:14px;line-height:1.6;color:${INK};">${esc(
          it.note
        )}</div>
      </td></tr>`
    )
    .join('') +
  `</table>`;

/** Small caps section heading inside the email body. */
const sectionTitle = (text) =>
  `<div style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ROSE};margin:30px 0 12px;">${esc(
    text
  )}</div>`;

/** Three side-by-side contact actions. */
const contactRow = ({ email, tel, book }) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;"><tr>
     <td align="center" style="background:${ROSE};padding:0;">
       <a href="mailto:${email}" style="display:block;padding:13px 8px;font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Email</a>
     </td>
     <td style="width:8px;font-size:0;">&nbsp;</td>
     <td align="center" style="background:${NAVY};padding:0;">
       <a href="sms:${tel}" style="display:block;padding:13px 8px;font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Text</a>
     </td>
     <td style="width:8px;font-size:0;">&nbsp;</td>
     <td align="center" style="background:${INK};padding:0;">
       <a href="${book}" style="display:block;padding:13px 8px;font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Book a Call</a>
     </td>
   </tr></table>`;

/**
 * Sign-off with headshot. Images are often blocked by default, so the block
 * still reads correctly with nothing loaded — hence the alt text and the fact
 * that no information lives only in the picture.
 */
const signature = ({ email, tel, book }) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 4px;border-top:1px solid rgba(30,59,87,0.12);padding-top:24px;width:100%;">
     <tr>
       <td width="78" valign="top" style="width:78px;padding-right:18px;">
         <img src="https://www.dakjencreative.com/dakotah-jennifer-headshot.jpg"
              width="78" height="78" alt="Dakotah Jennifer"
              style="display:block;width:78px;height:78px;border-radius:39px;object-fit:cover;border:2px solid ${ROSE};">
       </td>
       <td valign="top">
         <div style="font-family:${SANS};font-size:16px;font-weight:600;color:${NAVY};padding-bottom:3px;">Dakotah Jennifer</div>
         <div style="font-family:${SERIF};font-size:14px;color:#5b6672;padding-bottom:10px;">Founder &amp; CEO, DakJen Creative</div>
         <div style="font-family:${SERIF};font-size:13px;line-height:1.75;color:#5b6672;">
           <a href="mailto:${email}" style="color:${ROSE};text-decoration:none;">${esc(email)}</a><br>
           <a href="tel:${tel}" style="color:${ROSE};text-decoration:none;">${esc(tel)}</a>
           &nbsp;·&nbsp;
           <a href="${book}" style="color:${ROSE};text-decoration:none;">Book a call</a>
         </div>
       </td>
     </tr>
   </table>`;

async function sendEmail(payload) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  return res.json().catch(() => ({}));
}

module.exports = {
  sendEmail, layout, para, detailBlock, button, linkList, statList, sectionTitle, contactRow, signature,
  esc, escMultiline, NAVY, ROSE, CREAM, INK,
};
