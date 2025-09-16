import nodemailer from "nodemailer";

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function createTransporter() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    // fallback log mode
    return Promise.resolve({
      sendMail: async (opts: any) => {
        console.log("[MAIL:FAKE]", opts);
        return { messageId: "dev-log" };
      },
    } as any);
  }
  const port = Number(process.env.SMTP_PORT);
  const secure = port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter.verify().then(() => transporter);
}

async function getTransporter() {
  if (!transporterPromise) transporterPromise = createTransporter();
  return transporterPromise;
}

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}) {
  const from = process.env.MAIL_FROM || "no-reply@nexus-agile.local";
  const t = await getTransporter();
  return t.sendMail({ from, ...opts });
}
