'use client';

// Educational-only: plain-English insurance glossary + a general claim checklist.
// No advice, no product specifics. Safe to show without a licence.

const GLOSSARY: [string, string][] = [
  ['Sum assured / sum insured', 'The maximum amount the insurer will pay — your cover size.'],
  ['Premium', 'What you pay (monthly or yearly) to keep the policy active.'],
  ['Deductible', 'The part of a claim you pay yourself before the insurer pays the rest.'],
  ['Co-pay', 'A fixed share (e.g. 10%) of each health claim you always pay.'],
  ['Waiting period', 'Time after buying before certain claims (e.g. pre-existing illness) are covered.'],
  ['Rider / add-on', 'An optional extra cover you bolt onto the base policy for a bit more premium.'],
  ['IDV', 'Insured Declared Value — your vehicle’s current market value, the max a motor policy pays if it’s totalled/stolen.'],
  ['No-Claim Bonus (NCB)', 'A discount on motor renewal for every year you don’t claim.'],
  ['Free-look period', 'A short window after buying to cancel for a refund if you change your mind.'],
  ['Grace period', 'Extra days to pay a missed premium before the policy lapses.'],
  ['Nominee', 'The person who receives the payout on a life claim.'],
  ['Exclusions', 'Things the policy specifically does not cover — always read these.'],
];

const CLAIM_STEPS: [string, string][] = [
  ['Tell the insurer early', 'Call the insurer or TPA as soon as you can and note the claim / reference number.'],
  ['Gather documents', 'Policy number + ID, plus proof: hospital bills & discharge summary (health), FIR & repair estimate (motor), or death certificate & policy (life).'],
  ['Cashless or reimbursement', 'For health/motor, use a network hospital/garage for cashless, or pay first and claim back with bills.'],
  ['Submit within the time limit', 'Most claims have a deadline (often 7–30 days) — send the forms and documents before it.'],
  ['Track and follow up', 'Keep the reference number and follow up until it’s settled; escalate to the grievance officer if stuck.'],
];

function Acc({ title, children, sub }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <details className="card p-5 group">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
        <span>
          <span className="text-sm font-bold text-pine-900">{title}</span>
          {sub && <span className="block text-xs text-ink-faint mt-0.5">{sub}</span>}
        </span>
        <span className="text-ink-faint group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="mt-4 pw-fade-up">{children}</div>
    </details>
  );
}

export function PolicyHelp() {
  return (
    <div className="space-y-3">
      <Acc title="What your policy words mean" sub="Insurance jargon in plain English">
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {GLOSSARY.map(([term, meaning]) => (
            <div key={term}>
              <dt className="text-sm font-semibold text-ink">{term}</dt>
              <dd className="text-xs text-ink-soft leading-relaxed mt-0.5">{meaning}</dd>
            </div>
          ))}
        </dl>
      </Acc>

      <Acc title="How to make a claim" sub="A simple step-by-step for any policy">
        <ol className="space-y-3">
          {CLAIM_STEPS.map(([step, detail], i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-mint-100 text-pine-800 text-xs font-bold grid place-items-center">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-ink">{step}</p>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[11px] text-ink-faint leading-relaxed">General information to help you understand the process — not advice. Exact documents and timelines are set by your insurer and policy.</p>
      </Acc>
    </div>
  );
}
