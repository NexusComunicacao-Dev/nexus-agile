interface EmailTemplateOptions {
  title?: string;
  preheader?: string;
  heading?: string;
  body?: string | string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function buildEmailTemplate(opts: EmailTemplateOptions) {
  const {
    title = "Nexus Agile",
    preheader = "",
    heading = "Nexus Agile",
    body = "",
    ctaLabel,
    ctaUrl,
    footerNote = "Você recebeu este e-mail porque há atividade relacionada à sua conta ou projeto."
  } = opts;

  const bodyLines = Array.isArray(body) ? body : [body];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charSet="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  body { margin:0; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:#f6f7f9; }
  .container { max-width:560px; margin:24px auto 40px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #eceeef; box-shadow:0 4px 22px -2px rgba(0,0,0,0.06);}
  .header { background:linear-gradient(135deg,#FF7C1A,#ff9d59); padding:30px 34px; color:#fff; }
  h1 { margin:0; font-size:21px; line-height:1.25; font-weight:600; letter-spacing:.3px; }
  .preheader { display:none !important; visibility:hidden; opacity:0; height:0; mso-hide:all; }
  .content { padding:34px 36px 32px; color:#2a2d31; font-size:14px; line-height:1.58; }
  .content p { margin:0 0 15px; }
  .cta-wrapper { margin:30px 0 10px; }
  .cta { display:inline-block; background:#FF7C1A; color:#fff !important; text-decoration:none; padding:13px 26px; font-weight:600; border-radius:10px; font-size:14px; letter-spacing:.2px; box-shadow:0 2px 10px rgba(255,124,26,0.45); transition:background .25s;}
  .cta:hover { background:#f06f0e; }
  .badge { display:inline-block; background:#FFF4EC; color:#FF7C1A; font-size:11px; font-weight:600; padding:4px 10px; border-radius:20px; letter-spacing:.4px; margin-bottom:18px; }
  .divider { height:1px; background:#eceeef; margin:34px 0 26px; }
  .footer { font-size:11px; color:#888888; line-height:1.45; }
  .brand { font-weight:600; color:#FF7C1A; }
  @media (max-width:600px){
    .content { padding:30px 22px 28px; }
    .header { padding:26px 26px; }
  }
  @media (prefers-color-scheme: dark){
    body { background:#0e1114; }
    .container { background:#15191d; border-color:#1f2429; }
    .content { color:#d0d4d8; }
    .divider { background:#262c31; }
    .footer { color:#777; }
    .cta { box-shadow:0 2px 10px rgba(255,124,26,0.55); }
  }
</style>
</head>
<body>
<span class="preheader">${escapeHtml(preheader)}</span>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(heading)}</h1>
    </div>
    <div class="content">
      ${bodyLines.length ? `<div class="badge">NEXUS AGILE</div>` : ""}
      ${bodyLines.map(line => `<p>${escapeHtmlInline(line)}</p>`).join("")}
      ${
        ctaLabel && ctaUrl
          ? `<div class="cta-wrapper"><a class="cta" href="${escapeAttr(ctaUrl)}" target="_blank" rel="noopener">${escapeHtml(ctaLabel)}</a></div>`
          : ""
      }
      <div class="divider"></div>
      <div class="footer">
        <p><span class="brand">Nexus Agile</span> • Plataforma de colaboração e planejamento.</p>
        <p>${escapeHtmlInline(footerNote)}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...bodyLines,
    ctaLabel && ctaUrl ? `Ação: ${ctaLabel} => ${ctaUrl}` : "",
    "",
    "Nexus Agile"
  ].filter(Boolean).join("\n");

  return { html, text };
}

function escapeHtml(v: string) {
  return v.replace(/[&<>"']/g, s => (
    { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]!
  ));
}
function escapeAttr(v: string) {
  return escapeHtml(v);
}
function escapeHtmlInline(v?: string) {
  if (!v) return "";
  return escapeHtml(v).replace(/\n/g,"<br/>");
}
