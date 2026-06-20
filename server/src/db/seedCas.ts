// Seeds 5 demo Chartered Accountant accounts into the CA portal, so you can
// log in as a CA and connect to your demo users yourself. No client links are
// created here — connect them manually. Safe to re-run (upserts by mobile).
//
// A genuine individual CA always has an ICAI membership number, but may have
// NO firm/FRN/GSTIN/website (sole practitioners). The demo data reflects that:
// some are firms with full details, some are individual practitioners.
//
// Run:  DATABASE_URL="<your-db-uri>" npm run seed:cas
// LOGIN: app login → "I'm a CA" → Log in → mobile below → OTP from Railway logs
// (or 424242 locally). The connect code is what clients enter under "Your CA".

import { pool, one } from './index';

interface DemoCa {
  mobile: string; name: string; icai_number: string; email: string; city: string; connect_code: string;
  firm_name?: string | null; frn?: string | null; cop_number?: string | null;
  office_address?: string | null; website?: string | null; gstin?: string | null;
}

const CAS: DemoCa[] = [
  // Full firm CA — has everything.
  { mobile: '+918000000001', name: 'CA Rajesh Mehta', icai_number: '114562', email: 'rajesh@mehta-ca.in', city: 'Mumbai', connect_code: 'CA-MEHTA1',
    firm_name: 'Mehta & Associates', frn: '104562W', cop_number: '045231', office_address: '402, Maker Chambers, Nariman Point, Mumbai', website: 'mehta-ca.in', gstin: '27ABCDE1234F1Z5' },
  // Individual practitioner — no firm, no FRN, personal email.
  { mobile: '+918000000002', name: 'CA Anjali Deshpande', icai_number: '152340', email: 'anjali.deshpande@gmail.com', city: 'Pune', connect_code: 'CA-ANJ222',
    cop_number: '062118' },
  // Small firm — firm + FRN + COP, no GSTIN/website.
  { mobile: '+918000000003', name: 'CA Anil Kumar', icai_number: '208913', email: 'anil@kumarca.in', city: 'Bengaluru', connect_code: 'CA-KUMAR3',
    firm_name: 'Kumar Associates', frn: '012894S', cop_number: '071204' },
  // Freelance individual practitioner — gmail, COP only.
  { mobile: '+918000000004', name: 'CA Farhan Sheikh', icai_number: '231447', email: 'ca.farhan.sheikh@gmail.com', city: 'Hyderabad', connect_code: 'CA-FARH44',
    cop_number: '083356' },
  // Firm with full practice details.
  { mobile: '+918000000005', name: 'CA Deepa Nair', icai_number: '176320', email: 'deepa@nairpartners.in', city: 'Kochi', connect_code: 'CA-DEEPA5',
    firm_name: 'Nair & Partners', frn: '009217S', cop_number: '055890', office_address: '21 MG Road, Kochi, Kerala', website: 'nairpartners.in', gstin: '32PQRST5678U1Z2' },
];

async function upsert(c: DemoCa) {
  await one(
    `INSERT INTO cas (mobile, name, icai_number, email, city, firm_name, frn, cop_number, office_address, website, gstin, connect_code, verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
     ON CONFLICT (mobile) DO UPDATE SET
        name=EXCLUDED.name, icai_number=EXCLUDED.icai_number, email=EXCLUDED.email, city=EXCLUDED.city,
        firm_name=EXCLUDED.firm_name, frn=EXCLUDED.frn, cop_number=EXCLUDED.cop_number,
        office_address=EXCLUDED.office_address, website=EXCLUDED.website, gstin=EXCLUDED.gstin,
        connect_code=EXCLUDED.connect_code, verified=true, deleted_at=NULL
     RETURNING ca_id`,
    [c.mobile, c.name, c.icai_number, c.email, c.city, c.firm_name || null, c.frn || null, c.cop_number || null,
      c.office_address || null, c.website || null, c.gstin || null, c.connect_code]
  );
}

async function main() {
  console.log(`Seeding ${CAS.length} demo CAs...\n`);
  for (const c of CAS) {
    await upsert(c);
    const kind = c.firm_name ? `${c.firm_name}` : 'Individual practitioner';
    console.log(`  ✓ ${c.mobile}  ${c.connect_code.padEnd(9)} ${c.name.padEnd(20)} ICAI ${c.icai_number} · ${kind}, ${c.city}`);
  }
  console.log(`\n✓ Done. Log in via "I'm a CA" → Log in; OTP from Railway logs (or 424242 locally).`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
