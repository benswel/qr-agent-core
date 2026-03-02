import { Resend } from "resend";
import { config } from "../../config/index.js";

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;
const FROM = config.resend.from;

async function send(to: string, subject: string, html: string) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send:", err);
  }
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const wrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background-color:#0f0f10;padding:28px 40px">
          <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">QR for Agent</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px 40px;color:#1a1a1a;font-size:15px;line-height:1.7">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;text-align:center">
          QR for Agent &mdash; Dynamic QR codes for AI agents<br>
          <a href="https://qrforagent.com" style="color:#71717a">qrforagent.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const codeBlock = (text: string) =>
  `<div style="background-color:#18181b;border-radius:8px;padding:16px 20px;margin:16px 0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;color:#e4e4e7;word-break:break-all">${text}</div>`;

const button = (url: string, label: string) =>
  `<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background-color:#22c55e;border-radius:8px;padding:12px 28px"><a href="${url}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">${label}</a></td></tr></table>`;

// ---------------------------------------------------------------------------
// 1. Welcome email
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(
  email: string,
  apiKey: string,
  label: string
) {
  const html = wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f0f10">You're all set! 🎉</h1>
    <p style="margin:0 0 20px;color:#52525b">Welcome to QR for Agent, <strong>${label}</strong>. Here's your API key:</p>

    ${codeBlock(apiKey)}

    <p style="margin:0 0 8px;color:#dc2626;font-size:13px;font-weight:600">⚠ Store this key securely — it won't be shown again.</p>

    <h2 style="margin:28px 0 12px;font-size:16px;color:#0f0f10">Quick start</h2>

    <p style="margin:0 0 8px"><strong>Use with any MCP client:</strong></p>
    ${codeBlock(`npx qr-for-agent --api-key ${apiKey}`)}

    <p style="margin:0 0 8px"><strong>Or call the API directly:</strong></p>
    ${codeBlock(`curl -X POST https://api.qrforagent.com/api/qr \\<br>&nbsp;&nbsp;-H "X-API-Key: ${apiKey}" \\<br>&nbsp;&nbsp;-H "Content-Type: application/json" \\<br>&nbsp;&nbsp;-d '{"target_url": "https://example.com"}'`)}

    ${button("https://qrforagent.com/docs", "Read the docs")}

    <p style="margin:0;color:#52525b">You're on the <strong>Free plan</strong> (10 QR codes, 1K scans/month). Need more? <a href="https://qrforagent.com/pricing" style="color:#22c55e;text-decoration:none;font-weight:500">Upgrade to Pro</a> anytime.</p>

    <p style="margin:20px 0 0;color:#52525b">Happy building!<br><span style="color:#0f0f10;font-weight:500">The QR for Agent team</span></p>
  `);

  await send(email, "Welcome to QR for Agent — here's your API key", html);
}

// ---------------------------------------------------------------------------
// 2. Pro upgrade confirmation
// ---------------------------------------------------------------------------

export async function sendProUpgradeEmail(email: string) {
  const html = wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f0f10">Welcome to Pro! 🚀</h1>
    <p style="margin:0 0 20px;color:#52525b">Your upgrade is confirmed. Here's what just unlocked for you:</p>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#0f0f10;font-weight:500">✓ Unlimited QR codes</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#0f0f10;font-weight:500">✓ Unlimited scans</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#0f0f10;font-weight:500">✓ Unlimited webhooks</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#0f0f10;font-weight:500">✓ Custom domains</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#0f0f10;font-weight:500">✓ CSV bulk upload (500 QR/batch)</td></tr>
      <tr><td style="padding:8px 0;color:#0f0f10;font-weight:500">✓ Priority support</td></tr>
    </table>

    <p style="margin:0 0 20px;color:#52525b">Your subscription is $19/month. You can manage your billing, download invoices, or cancel anytime from the Customer Portal.</p>

    ${button("https://qrforagent.com/pricing", "Manage billing")}

    <p style="margin:0;color:#52525b">Thanks for supporting QR for Agent!<br><span style="color:#0f0f10;font-weight:500">The QR for Agent team</span></p>
  `);

  await send(email, "You're now on QR for Agent Pro", html);
}

// ---------------------------------------------------------------------------
// 3. Subscription canceled
// ---------------------------------------------------------------------------

export async function sendCancellationEmail(email: string) {
  const html = wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f0f10">Subscription canceled</h1>
    <p style="margin:0 0 20px;color:#52525b">We're sorry to see you go. Your Pro plan has been canceled and your account has been moved back to the Free plan.</p>

    <h2 style="margin:0 0 12px;font-size:16px;color:#0f0f10">What happens now</h2>
    <ul style="margin:0 0 20px;padding-left:20px;color:#52525b;line-height:2">
      <li>Your existing QR codes <strong>remain active</strong> — nothing breaks.</li>
      <li>You're back to Free limits: 10 QR codes, 1K scans/month, 1 webhook.</li>
      <li>Custom domains and CSV bulk upload are no longer available.</li>
    </ul>

    <p style="margin:0 0 20px;color:#52525b">If you change your mind, you can re-upgrade at any time — your data is safe.</p>

    ${button("https://qrforagent.com/pricing", "Re-upgrade to Pro")}

    <p style="margin:0;color:#52525b">We'd love to hear what we could improve. Just reply to this email.<br><span style="color:#0f0f10;font-weight:500">The QR for Agent team</span></p>
  `);

  await send(email, "Your QR for Agent Pro subscription has been canceled", html);
}

// ---------------------------------------------------------------------------
// 4. Payment failed
// ---------------------------------------------------------------------------

export async function sendPaymentFailedEmail(email: string) {
  const html = wrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f0f10">Heads up — payment issue</h1>
    <p style="margin:0 0 20px;color:#52525b">Your last payment for QR for Agent Pro didn't go through. Don't worry — your Pro features are still active while we retry.</p>

    <p style="margin:0 0 20px;color:#52525b">To avoid any interruption, please update your payment method:</p>

    ${button("https://qrforagent.com/pricing", "Update payment method")}

    <p style="margin:0 0 20px;color:#52525b;font-size:13px">Stripe will automatically retry the charge over the next few days. If the payment continues to fail, your account will be moved to the Free plan.</p>

    <p style="margin:0;color:#52525b">Need help? Just reply to this email.<br><span style="color:#0f0f10;font-weight:500">The QR for Agent team</span></p>
  `);

  await send(email, "Action needed — update your payment method", html);
}
