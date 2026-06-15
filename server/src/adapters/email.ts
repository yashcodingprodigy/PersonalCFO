import { config } from '../config';

// Email adapter. "dev" logs the email to the server console (visible in
// Railway logs). "resend" sends via the Resend API (needs RESEND_API_KEY and a
// verified sending domain, e.g. noreply@paywatch.in).
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (config.emailProvider === 'resend' && config.resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.emailFrom, to, subject, html }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  console.log(`[email:dev] → ${to} · ${subject}`);
  return true;
}

// Renders a simple, on-brand briefing/alerts digest email.
export function renderDigestEmail(opts: {
  name: string; month: string; score: number | null; scoreDelta: number | null;
  investThisMonth: number; topAction: string | null;
  alerts: { title: string; body: string; severity: string }[];
}): string {
  const inr = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`;
  const sevColor: Record<string, string> = { urgent: '#C2402A', warning: '#C77E1F', info: '#16544B', good: '#2E9E44' };
  const alertRows = opts.alerts.slice(0, 8).map((a) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #F2EFE8;">
      <div style="font-weight:700;color:#1A2421;font-size:14px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sevColor[a.severity] || '#16544B'};margin-right:8px;"></span>${a.title}
      </div>
      <div style="color:#48544F;font-size:13px;margin-top:3px;">${a.body}</div>
    </td></tr>`).join('');

  return `<!doctype html><html><body style="margin:0;background:#F7F5F0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="font-size:20px;font-weight:800;color:#0B2F2A;margin-bottom:4px;">Pay<span style="font-style:italic">Watch</span></div>
    <div style="color:#7C8782;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">${opts.month} · your money this month</div>
    <div style="background:#fff;border-radius:14px;padding:20px;margin-top:14px;box-shadow:0 1px 2px rgba(26,36,33,.05);">
      <table width="100%"><tr>
        <td style="font-size:13px;color:#7C8782;">Money Health Score<br><span style="font-size:22px;font-weight:700;color:#1A2421;">${opts.score ?? '—'}</span> ${opts.scoreDelta ? `<span style="color:${opts.scoreDelta > 0 ? '#2E9E44' : '#C2402A'};font-size:13px;">${opts.scoreDelta > 0 ? '▲' : '▼'} ${Math.abs(opts.scoreDelta)}</span>` : ''}</td>
        <td style="font-size:13px;color:#7C8782;">Invest this month<br><span style="font-size:22px;font-weight:700;color:#16544B;">${inr(opts.investThisMonth)}</span></td>
      </tr></table>
      ${opts.topAction ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #F2EFE8;font-size:13px;color:#48544F;"><strong style="color:#1A2421;">Your #1 move:</strong> ${opts.topAction}</div>` : ''}
    </div>
    ${opts.alerts.length ? `<div style="background:#fff;border-radius:14px;padding:20px;margin-top:14px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:#7C8782;margin-bottom:6px;">Needs your attention</div>
      <table width="100%">${alertRows}</table>
    </div>` : ''}
    <div style="text-align:center;margin-top:18px;">
      <a href="${config.appUrl}/dashboard" style="display:inline-block;background:#2FBC9B;color:#07211D;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:999px;font-size:14px;">Open PayWatch</a>
    </div>
    <div style="color:#7C8782;font-size:11px;text-align:center;margin-top:16px;line-height:1.5;">
      Educational reminders based on your data, not investment/tax advice.<br>You're receiving this because you added an email in PayWatch settings.
    </div>
  </div></body></html>`;
}
