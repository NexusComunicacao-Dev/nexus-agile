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
  body { margin:0; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:#f5f7fb; }
  .container { max-width:560px; margin:24px auto 40px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e9f2; box-shadow:0 4px 18px rgba(0,0,0,0.06);}
  .header { background:linear-gradient(135deg,#4f46e5,#6366f1); padding:28px 32px; color:#fff; }
  h1 { margin:0; font-size:20px; line-height:1.3; }
  .preheader { display:none !important; visibility:hidden; opacity:0; height:0; mso-hide:all; }
  .content { padding:32px 34px 30px; color:#1f2937; font-size:14px; line-height:1.55; }
  .content p { margin:0 0 14px; }
  .cta-wrapper { margin:28px 0 8px; }
  .cta { display:inline-block; background:#4f46e5; color:#fff !important; text-decoration:none; padding:12px 24px; font-weight:600; border-radius:8px; font-size:14px; letter-spacing:.3px; box-shadow:0 2px 8px rgba(79,70,229,0.45); }
  .cta:hover { background:#4338ca; }
  .divider { height:1px; background:#e5e9f2; margin:30px 0 24px; }
  .footer { font-size:11px; color:#6b7280; line-height:1.4; }
  .brand { font-weight:600; color:#4f46e5; }
  @media (max-width:600px){
    .content { padding:28px 22px 26px; }
    .header { padding:24px 24px; }
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
