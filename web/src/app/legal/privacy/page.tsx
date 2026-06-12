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
        <li>We never sell your data. Our revenue is subscriptions and clearly disclosed referral commissions — not your data.</li>
        <li>We never share individual financial data with employers (on employer-sponsored plans, employers see only anonymised aggregates with a minimum group size of 10).</li>
        <li>We never share data with third parties without explicit, per-action consent shown to you before each share.</li>
        <li>We never train shared AI models on your personal data. The personalisation layer (your private RAG memory) lives in our database, scoped to your account alone, and is deleted with your account.</li>
      </ul>

      <h2>Where your data lives</h2>
      <p>
        All data is stored on servers located in India (AWS Mumbai region, ap-south-1), encrypted at rest with
        AES-256 and in transit with TLS 1.3. Field-level encryption applies to sensitive identifiers. There is
        no cross-border transfer of your personal data.
      </p>

      <h2>Your rights (DPDP Act, 2023)</h2>
      <ul>
        <li><strong>Access & portability:</strong> download your complete data as JSON from Settings, any time.</li>
        <li><strong>Correction:</strong> edit any data point in the app directly.</li>
        <li><strong>Erasure:</strong> delete your account from Settings — all personal data is permanently removed within 7 days. GST invoice records are retained in anonymised form for the statutory period, as required by law.</li>
        <li><strong>Consent withdrawal:</strong> revoke Account Aggregator consent in Settings; AA-sourced data is deleted within 24 hours.</li>
        <li><strong>Grievance:</strong> grievance@personalcfo.in — acknowledged within 48 hours.</li>
      </ul>

      <h2>Retention</h2>
      <p>
        Active accounts: data retained while you use the service. Cancelled subscriptions: data retained 90 days
        so you can return, then queued for deletion. Deleted accounts: removed within 7 days of the request.
        Uploaded statement files are deleted within 24 hours of parsing.
      </p>

      <h2>Cookies & tracking</h2>
      <p>
        The web app uses only functional storage (your session tokens) on your own device. No advertising
        trackers, no third-party analytics cookies.
      </p>
    </>
  );
}
