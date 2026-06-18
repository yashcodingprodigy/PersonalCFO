export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: June 2026 · Written in plain English, because a privacy policy you can&apos;t read protects no one.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Identity:</strong> mobile number, name, city, age — to run your account and personalise calculations.</li>
        <li><strong>Financial data you enter:</strong> income, assets, loans, insurance, tax inputs — the entire product runs on this.</li>
        <li><strong>Bank data via Account Aggregator:</strong> only with your explicit consent, only the scope you approve (balances, transactions, holdings — view only), fetched through the RBI-regulated AA framework. We never receive or store your bank credentials.</li>
        <li><strong>Usage data:</strong> which features you use, anonymised — to improve the product.</li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>We never sell your data. Our revenue is subscriptions (and any clearly disclosed referral commissions) — not your data.</li>
        <li>We never share your individual financial data with advertisers or employers.</li>
        <li>We never train shared/public AI models on your personal data. Your private personalisation memory is scoped to your account alone and is deleted with your account.</li>
      </ul>

      <h2>Service providers we use</h2>
      <p>
        To run PayWatch we rely on a small number of processors that handle data strictly on our instructions:
        our cloud hosting &amp; database provider (Railway), our email provider (Resend, only if you add an email),
        push-notification delivery (Google Firebase Cloud Messaging, only on the mobile app), and our payment
        provider (Razorpay, for subscriptions). When you scan a statement, the file is parsed <strong>on your own
        device</strong> using libraries loaded from a public CDN (Cloudflare) — the file itself never leaves your
        device. We do not sell or rent your data to anyone.
      </p>

      <h2>Where your data lives</h2>
      <p>
        PayWatch runs on managed cloud infrastructure (Railway). Your data is encrypted in transit (HTTPS/TLS) and
        at rest by our hosting and database providers. Depending on the hosting region in use, some processing may
        occur on servers outside India; where that happens it is done under the safeguards permitted by the DPDP
        Act. We are working toward an India-region deployment for full data residency. Passwords are not used
        (mobile-OTP login); OTPs and session tokens are stored only in hashed form.
      </p>

      <h2>Children</h2>
      <p>
        PayWatch is intended for users aged 18 and above. If you are under 18, a parent or guardian must set up and
        consent to the account on your behalf; we record that consent at sign-up. We do not knowingly process a
        minor&apos;s data without verifiable parental consent.
      </p>

      <h2>Security incidents</h2>
      <p>
        If a personal-data breach occurs, we will notify the Data Protection Board of India and affected users
        without undue delay, describing the nature of the breach, its likely impact, and the steps we are taking.
      </p>

      <h2>Your rights (DPDP Act, 2023)</h2>
      <ul>
        <li><strong>Access & portability:</strong> download your complete data as JSON from Settings, any time.</li>
        <li><strong>Correction:</strong> edit any data point in the app directly.</li>
        <li><strong>Erasure:</strong> delete your account from Settings — all personal data is permanently removed within 7 days. GST invoice records are retained in anonymised form for the statutory period, as required by law.</li>
        <li><strong>Consent withdrawal:</strong> revoke Account Aggregator consent in Settings; AA-sourced data is deleted within 24 hours.</li>
        <li><strong>Grievance:</strong> our Grievance Officer (contactable at grievance@paywatch.in) acknowledges complaints within 48 hours and resolves them within 30 days, per the DPDP Act and IT Rules, 2021.</li>
      </ul>

      <h2>Retention</h2>
      <p>
        Active accounts: data retained while you use the service. Cancelled subscriptions: data retained 90 days
        so you can return, then queued for deletion. Deleted accounts: removed within 7 days of the request.
        Statement and Form-16 files are parsed entirely on your device and are never uploaded to our servers.
      </p>

      <h2>Cookies & tracking</h2>
      <p>
        The web app uses only functional storage (your session tokens) on your own device. No advertising
        trackers, no third-party analytics cookies.
      </p>
    </>
  );
}
