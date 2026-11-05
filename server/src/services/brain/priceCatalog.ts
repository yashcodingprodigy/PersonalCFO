// PayWatch's own price knowledge — brands and models people actually dream about, with
// approximate Indian prices (2025–26, rupees). This is first-party data the money brain owns:
// it answers instantly, offline, and is never overridden by an AI guess. Extend freely;
// every entry is a planning range, not a quote.
//
// Vehicles: ex-showroom ranges for popular variants; on-road adds ~10–20% (tax, insurance, registration).

export interface CatalogVariant { label: string; rupees: number; note?: string }
export interface CatalogModel { re: RegExp; name: string; variants: CatalogVariant[] }
export interface CatalogBrand { re: RegExp; brand: string; generic?: boolean; kind: 'car' | 'bike' | 'phone' | 'laptop' | 'watch' | 'gadget'; basis: string; models: CatalogModel[]; fallback: CatalogVariant[] }

const V = (label: string, rupees: number, note?: string): CatalogVariant => ({ label, rupees, note });
const CAR = 'Approx. ex-showroom price in India; on-road adds ~10–20% (road tax, insurance, registration).';
const LUX = 'Approx. ex-showroom price in India; on-road adds ~15–25% for luxury cars. Options can add a lot.';
const BIKE = 'Approx. ex-showroom price in India; on-road adds ~10–15%.';
const GADGET = 'Approx. launch / retail price in India; bank offers and exchange can lower it.';

export const CATALOG: CatalogBrand[] = [
  // ── luxury & super cars ─────────────────────────────────────────────
  { re: /porsche|porche|porshe|porshce/i, brand: 'Porsche', kind: 'car', basis: LUX, models: [
    { re: /macan/i, name: 'Porsche Macan', variants: [V('Macan (petrol)', 9600000), V('Macan EV', 12500000), V('Macan Turbo EV', 16000000)] },
    { re: /cayenne/i, name: 'Porsche Cayenne', variants: [V('Cayenne', 14000000), V('Cayenne Coupé', 15500000), V('Cayenne Turbo E-Hybrid', 20000000)] },
    { re: /\b911\b|carrera|gt3|turbo s/i, name: 'Porsche 911', variants: [V('911 Carrera', 19000000), V('911 Carrera 4 GTS', 26000000), V('911 Turbo S', 37000000)] },
    { re: /taycan/i, name: 'Porsche Taycan', variants: [V('Taycan', 17000000), V('Taycan 4S', 19500000), V('Taycan Turbo S', 26000000)] },
    { re: /panamera/i, name: 'Porsche Panamera', variants: [V('Panamera', 17000000), V('Panamera 4 E-Hybrid', 21000000), V('Panamera Turbo', 28000000)] },
    { re: /718|cayman|boxster/i, name: 'Porsche 718', variants: [V('718 Cayman', 14000000), V('718 Boxster', 15000000), V('718 GTS 4.0', 18000000)] },
  ], fallback: [V('Macan (entry Porsche)', 9600000), V('Cayenne', 14000000), V('Taycan', 17000000), V('911 Carrera', 19000000)] },
  { re: /ferrari/i, brand: 'Ferrari', kind: 'car', basis: LUX, models: [], fallback: [V('Roma / Portofino M', 40000000), V('296 GTB', 55000000), V('Purosangue / SF90', 75000000)] },
  { re: /lamborghini|lambo\b/i, brand: 'Lamborghini', kind: 'car', basis: LUX, models: [
    { re: /urus/i, name: 'Lamborghini Urus', variants: [V('Urus SE', 42000000), V('Urus Performante', 45000000)] },
    { re: /huracan|temerario/i, name: 'Lamborghini Huracán / Temerario', variants: [V('Huracán / Temerario', 45000000), V('Top variant', 60000000)] },
  ], fallback: [V('Urus', 42000000), V('Temerario', 60000000), V('Revuelto', 85000000)] },
  { re: /rolls[- ]?royce|\brolls\b/i, brand: 'Rolls-Royce', kind: 'car', basis: LUX, models: [], fallback: [V('Ghost', 70000000), V('Cullinan', 70000000), V('Phantom', 90000000)] },
  { re: /bentley/i, brand: 'Bentley', kind: 'car', basis: LUX, models: [], fallback: [V('Continental GT', 40000000), V('Bentayga', 45000000), V('Flying Spur', 50000000)] },
  { re: /aston martin/i, brand: 'Aston Martin', kind: 'car', basis: LUX, models: [], fallback: [V('Vantage', 40000000), V('DBX', 42000000), V('DB12', 46000000)] },
  { re: /maserati/i, brand: 'Maserati', kind: 'car', basis: LUX, models: [], fallback: [V('Grecale', 13000000), V('Levante', 16000000), V('MC20', 37000000)] },
  { re: /mercedes|merc\b|benz|amg|maybach/i, brand: 'Mercedes-Benz', kind: 'car', basis: LUX, models: [
    { re: /\ba[ -]?class|a ?200|\bgla\b/i, name: 'Mercedes A-Class / GLA', variants: [V('A-Class Limousine', 4600000), V('GLA', 5100000)] },
    { re: /c[ -]?class|c ?200|c ?300/i, name: 'Mercedes C-Class', variants: [V('C 200', 6000000), V('C 300d', 6800000), V('C 43 AMG', 9800000)] },
    { re: /e[ -]?class|e ?200|e ?350/i, name: 'Mercedes E-Class LWB', variants: [V('E 200', 7900000), V('E 450', 9300000)] },
    { re: /\bglc\b/i, name: 'Mercedes GLC', variants: [V('GLC 300', 7600000), V('GLC 220d', 7700000)] },
    { re: /\bgle\b/i, name: 'Mercedes GLE', variants: [V('GLE 300d', 9900000), V('GLE 450', 11500000)] },
    { re: /s[ -]?class|maybach/i, name: 'Mercedes S-Class / Maybach', variants: [V('S 350d', 18000000), V('S 450', 19000000), V('Maybach S 580', 27000000)] },
    { re: /g[ -]?(class|wagon)|g ?63|\bg ?400/i, name: 'Mercedes G-Class', variants: [V('G 400d', 26000000), V('AMG G 63', 37000000)] },
  ], fallback: [V('A-Class / GLA (entry)', 4600000), V('C-Class', 6000000), V('GLC', 7600000), V('E-Class', 7900000)] },
  { re: /\bbmw\b.*\b(bike|motorrad|g ?310|s ?1000|gs)\b|\bg ?310|\bs ?1000 ?rr|\br ?1300 ?gs/i, brand: 'BMW Motorrad', kind: 'bike', basis: BIKE, models: [], fallback: [V('G 310 R/GS', 300000), V('F 900 R', 1000000), V('R 1300 GS / S 1000 RR', 2100000)] },
  { re: /\bbmw\b|beemer/i, brand: 'BMW', kind: 'car', basis: LUX, models: [
    { re: /\b2 ?series|\bx1\b/i, name: 'BMW 2 Series / X1', variants: [V('2 Series Gran Coupé', 4400000), V('X1', 5000000)] },
    { re: /\b3 ?series|330|m340/i, name: 'BMW 3 Series', variants: [V('330Li', 6200000), V('M340i', 7500000)] },
    { re: /\b5 ?series|530/i, name: 'BMW 5 Series LWB', variants: [V('530Li', 7300000)] },
    { re: /\bx3\b/i, name: 'BMW X3', variants: [V('X3', 7500000)] },
    { re: /\bx5\b/i, name: 'BMW X5', variants: [V('X5', 9800000), V('X5 M Sport', 11000000)] },
    { re: /\bx7\b|7 ?series|\bi7\b/i, name: 'BMW X7 / 7 Series', variants: [V('X7', 13000000), V('7 Series', 18500000), V('i7', 20500000)] },
    { re: /\bm[2-8]\b|\bm ?power|\bxm\b/i, name: 'BMW M cars', variants: [V('M2', 10000000), V('M4 Competition', 15000000), V('M5 / XM', 20000000)] },
  ], fallback: [V('X1 / 2 Series (entry)', 4600000), V('3 Series', 6200000), V('X3 / 5 Series', 7500000), V('X5', 9800000)] },
  { re: /\baudi\b/i, brand: 'Audi', kind: 'car', basis: LUX, models: [
    { re: /\ba4\b/i, name: 'Audi A4', variants: [V('A4', 4700000)] }, { re: /\ba6\b/i, name: 'Audi A6', variants: [V('A6', 6600000)] },
    { re: /\bq3\b/i, name: 'Audi Q3', variants: [V('Q3', 4500000)] }, { re: /\bq5\b/i, name: 'Audi Q5', variants: [V('Q5', 6700000)] },
    { re: /\bq7\b|\bq8\b/i, name: 'Audi Q7 / Q8', variants: [V('Q7', 9000000), V('Q8', 11800000)] },
    { re: /\brs|e-?tron gt|\br8\b/i, name: 'Audi RS / e-tron GT', variants: [V('RS Q8', 22000000), V('RS e-tron GT', 19500000)] },
  ], fallback: [V('Q3 / A4 (entry)', 4600000), V('Q5 / A6', 6700000), V('Q7', 9000000)] },
  { re: /range rover|land rover|defender|discovery|jaguar/i, brand: 'JLR', kind: 'car', basis: LUX, models: [
    { re: /defender/i, name: 'Land Rover Defender', variants: [V('Defender 110', 10500000), V('Defender 130', 12500000), V('Defender Octa', 27000000)] },
    { re: /evoque/i, name: 'Range Rover Evoque', variants: [V('Evoque', 7000000)] },
    { re: /velar/i, name: 'Range Rover Velar', variants: [V('Velar', 8700000)] },
    { re: /range rover sport/i, name: 'Range Rover Sport', variants: [V('RR Sport', 14000000)] },
    { re: /discovery/i, name: 'Land Rover Discovery', variants: [V('Discovery Sport', 6700000), V('Discovery', 9800000)] },
    { re: /jaguar/i, name: 'Jaguar', variants: [V('F-Pace', 7300000)] },
  ], fallback: [V('Evoque', 7000000), V('Defender', 10500000), V('Range Rover Sport', 14000000), V('Range Rover', 24000000)] },
  { re: /\bvolvo\b/i, brand: 'Volvo', kind: 'car', basis: LUX, models: [], fallback: [V('XC40 Recharge', 5500000), V('XC60', 6900000), V('XC90', 10000000)] },
  { re: /\blexus\b/i, brand: 'Lexus', kind: 'car', basis: LUX, models: [], fallback: [V('NX', 6800000), V('ES', 6400000), V('RX', 9500000), V('LX', 30000000)] },
  { re: /\btesla\b/i, brand: 'Tesla', kind: 'car', basis: LUX, models: [], fallback: [V('Model Y', 6000000), V('Model Y Long Range', 6800000)] },
  { re: /\bmini\b ?(cooper)?|mini cooper/i, brand: 'MINI', kind: 'car', basis: LUX, models: [], fallback: [V('Cooper S', 4500000), V('Countryman', 5500000)] },

  // ── mass-market cars ────────────────────────────────────────────────
  { re: /fortuner|innova|hycross|camry|hyryder|glanza|toyota/i, brand: 'Toyota', kind: 'car', basis: CAR, models: [
    { re: /fortuner/i, name: 'Toyota Fortuner', variants: [V('Fortuner 4x2', 3500000), V('Fortuner 4x4', 4300000), V('Legender', 4500000)] },
    { re: /innova|hycross/i, name: 'Toyota Innova', variants: [V('Innova Crysta', 2000000), V('Innova Hycross', 2400000), V('Hycross Hybrid top', 3200000)] },
    { re: /camry/i, name: 'Toyota Camry', variants: [V('Camry Hybrid', 4800000)] },
  ], fallback: [V('Glanza / Hyryder', 1200000), V('Innova Hycross', 2400000), V('Fortuner', 3500000)] },
  { re: /mahindra|thar|scorpio|xuv ?700|xuv ?3xo|xuv700|be ?6|xev/i, brand: 'Mahindra', kind: 'car', basis: CAR, models: [
    { re: /thar/i, name: 'Mahindra Thar', variants: [V('Thar', 1200000), V('Thar Roxx', 1600000), V('Thar Roxx top', 2300000)] },
    { re: /scorpio/i, name: 'Mahindra Scorpio-N', variants: [V('Scorpio-N', 1400000), V('Scorpio-N Z8L', 2200000)] },
    { re: /xuv ?700/i, name: 'Mahindra XUV700', variants: [V('XUV700 MX', 1400000), V('XUV700 AX7L', 2400000)] },
    { re: /be ?6|xev/i, name: 'Mahindra BE 6 / XEV 9e', variants: [V('BE 6', 1900000), V('XEV 9e', 2200000), V('Top variant', 3000000)] },
  ], fallback: [V('XUV 3XO', 800000), V('Thar', 1200000), V('Scorpio-N', 1400000), V('XUV700', 1800000)] },
  { re: /\btata\b|nexon|harrier|safari|punch|curvv|altroz|tiago/i, brand: 'Tata', kind: 'car', basis: CAR, models: [
    { re: /nexon/i, name: 'Tata Nexon', variants: [V('Nexon', 800000), V('Nexon top', 1400000), V('Nexon EV', 1500000)] },
    { re: /harrier|safari/i, name: 'Tata Harrier / Safari', variants: [V('Harrier', 1500000), V('Safari', 1600000), V('Top / EV', 2700000)] },
    { re: /punch/i, name: 'Tata Punch', variants: [V('Punch', 600000), V('Punch EV', 1000000)] },
    { re: /curvv/i, name: 'Tata Curvv', variants: [V('Curvv', 1000000), V('Curvv EV', 1700000)] },
  ], fallback: [V('Tiago / Punch', 600000), V('Nexon', 800000), V('Harrier / Safari', 1500000)] },
  { re: /maruti|suzuki|swift|baleno|brezza|dzire|ertiga|grand vitara|wagon ?r|alto|fronx|jimny/i, brand: 'Maruti Suzuki', kind: 'car', basis: CAR, models: [
    { re: /swift|dzire/i, name: 'Maruti Swift / Dzire', variants: [V('Swift', 650000), V('Swift top', 950000), V('Dzire', 700000)] },
    { re: /baleno|fronx/i, name: 'Maruti Baleno / Fronx', variants: [V('Baleno', 700000), V('Fronx', 800000)] },
    { re: /brezza/i, name: 'Maruti Brezza', variants: [V('Brezza', 850000), V('Brezza top', 1400000)] },
    { re: /grand vitara/i, name: 'Maruti Grand Vitara', variants: [V('Grand Vitara', 1100000), V('Strong Hybrid', 1900000)] },
    { re: /alto|wagon ?r/i, name: 'Maruti Alto / Wagon R', variants: [V('Alto K10', 400000), V('Wagon R', 550000)] },
  ], fallback: [V('Wagon R / Swift', 600000), V('Brezza', 850000), V('Grand Vitara', 1100000)] },
  { re: /hyundai|creta|venue|verna|i20|exter|alcazar|tucson|kia|seltos|sonet|carens|honda city|elevate|skoda|kushaq|slavia|volkswagen|\bvw\b|taigun|virtus|\bmg\b|hector|windsor/i, brand: 'Popular SUV / sedan', generic: true, kind: 'car', basis: CAR, models: [
    { re: /creta|seltos/i, name: 'Hyundai Creta / Kia Seltos', variants: [V('Base', 1100000), V('Mid', 1500000), V('Top', 2000000)] },
    { re: /venue|sonet|exter/i, name: 'Hyundai Venue / Kia Sonet', variants: [V('Base', 800000), V('Top', 1400000)] },
    { re: /verna|honda city|virtus|slavia/i, name: 'Verna / City / Virtus / Slavia', variants: [V('Base', 1150000), V('Top', 1750000)] },
    { re: /i20/i, name: 'Hyundai i20', variants: [V('i20', 700000), V('i20 N Line', 1000000)] },
    { re: /alcazar|tucson|hector|carens/i, name: 'Alcazar / Tucson / Hector / Carens', variants: [V('Carens / Hector', 1500000), V('Alcazar', 1500000), V('Tucson', 2900000)] },
  ], fallback: [V('Compact SUV', 800000), V('Mid-size SUV (Creta class)', 1100000), V('Sedan (City class)', 1200000), V('Top variants', 2000000)] },

  // ── two-wheelers ────────────────────────────────────────────────────
  { re: /harley|davidson/i, brand: 'Harley-Davidson', kind: 'bike', basis: BIKE, models: [
    { re: /x ?440/i, name: 'Harley-Davidson X440', variants: [V('X440', 240000), V('X440 S', 300000)] },
  ], fallback: [V('X440 (entry)', 240000), V('Nightster / Sportster S', 1600000), V('Fat Boy / Street Glide', 2500000)] },
  { re: /ducati/i, brand: 'Ducati', kind: 'bike', basis: BIKE, models: [], fallback: [V('Scrambler', 1100000), V('Monster', 1300000), V('Panigale V4', 3000000)] },
  { re: /kawasaki|ninja|\bz ?900/i, brand: 'Kawasaki', kind: 'bike', basis: BIKE, models: [
    { re: /ninja ?300|ninja ?500/i, name: 'Kawasaki Ninja 300/500', variants: [V('Ninja 300', 340000), V('Ninja 500', 540000)] },
    { re: /zx-?10|zx10/i, name: 'Kawasaki ZX-10R', variants: [V('ZX-10R', 1800000)] },
  ], fallback: [V('Ninja 300', 340000), V('Z900', 950000), V('ZX-10R', 1800000)] },
  { re: /triumph/i, brand: 'Triumph', kind: 'bike', basis: BIKE, models: [], fallback: [V('Speed 400', 250000), V('Trident 660', 800000), V('Tiger 900', 1400000)] },
  { re: /royal enfield|enfield|bullet|classic 350|himalayan|interceptor|hunter|meteor|guerrilla|continental gt/i, brand: 'Royal Enfield', kind: 'bike', basis: BIKE, models: [
    { re: /hunter/i, name: 'RE Hunter 350', variants: [V('Hunter 350', 150000)] },
    { re: /classic|bullet/i, name: 'RE Classic / Bullet 350', variants: [V('Bullet 350', 175000), V('Classic 350', 195000)] },
    { re: /himalayan/i, name: 'RE Himalayan 450', variants: [V('Himalayan 450', 285000)] },
    { re: /interceptor|continental/i, name: 'RE 650 twins', variants: [V('Interceptor 650', 310000), V('Continental GT 650', 330000)] },
  ], fallback: [V('Hunter 350', 150000), V('Classic 350', 195000), V('Himalayan 450', 285000), V('Interceptor 650', 310000)] },
  { re: /\bktm\b|duke|\brc ?390/i, brand: 'KTM', kind: 'bike', basis: BIKE, models: [], fallback: [V('Duke 200', 200000), V('Duke 390', 300000), V('390 Adventure', 370000)] },
  { re: /activa|jupiter|ntorq|access|ather|ola s1|chetak|\bscooty\b|vida/i, brand: 'Scooter', generic: true, kind: 'bike', basis: BIKE, models: [], fallback: [V('Petrol scooter (Activa class)', 85000), V('Electric (Chetak / iQube)', 120000), V('Premium EV (Ather / Ola S1 Pro)', 150000)] },

  // ── phones, laptops, watches ────────────────────────────────────────
  { re: /iphone/i, brand: 'Apple iPhone', kind: 'phone', basis: GADGET, models: [
    { re: /pro max/i, name: 'iPhone Pro Max', variants: [V('256 GB', 150000), V('512 GB', 170000), V('1 TB', 190000)] },
    { re: /\bpro\b/i, name: 'iPhone Pro', variants: [V('128/256 GB', 130000), V('512 GB', 150000)] },
    { re: /\bair\b|plus/i, name: 'iPhone Air / Plus', variants: [V('Base', 90000), V('More storage', 110000)] },
    { re: /\b1[0-4]\b|\bse\b|\b16e\b/i, name: 'Older / budget iPhone', variants: [V('Budget iPhone', 55000), V('Last year’s model', 70000)] },
  ], fallback: [V('iPhone (base)', 80000), V('iPhone Pro', 130000), V('iPhone Pro Max', 150000)] },
  { re: /samsung|galaxy|\bs2[4-9]\b|fold|flip/i, brand: 'Samsung Galaxy', kind: 'phone', basis: GADGET, models: [
    { re: /fold/i, name: 'Galaxy Z Fold', variants: [V('Z Fold', 175000)] }, { re: /flip/i, name: 'Galaxy Z Flip', variants: [V('Z Flip', 110000)] },
    { re: /ultra/i, name: 'Galaxy S Ultra', variants: [V('S Ultra', 130000)] },
  ], fallback: [V('A-series', 25000), V('S-series', 80000), V('S Ultra', 130000), V('Z Fold', 175000)] },
  { re: /oneplus|pixel|nothing phone|\bphone\b|smartphone|mobile/i, brand: 'Smartphone', generic: true, kind: 'phone', basis: GADGET, models: [], fallback: [V('Budget', 15000), V('Mid-range', 30000), V('Flagship', 70000), V('Top flagship', 130000)] },
  { re: /macbook|\bmac\b|imac/i, brand: 'Apple Mac', kind: 'laptop', basis: GADGET, models: [
    { re: /air/i, name: 'MacBook Air', variants: [V('13"', 100000), V('15"', 125000)] },
    { re: /pro/i, name: 'MacBook Pro', variants: [V('14" M-series', 170000), V('14" Pro chip', 200000), V('16" Max', 350000)] },
  ], fallback: [V('MacBook Air', 100000), V('MacBook Pro 14"', 170000), V('MacBook Pro 16"', 250000)] },
  { re: /laptop|notebook|gaming pc|\bpc\b|computer/i, brand: 'Laptop / PC', generic: true, kind: 'laptop', basis: GADGET, models: [], fallback: [V('Everyday laptop', 45000), V('Good work laptop', 75000), V('Gaming laptop / PC', 130000)] },
  { re: /\bipad\b|tablet/i, brand: 'Tablet', generic: true, kind: 'gadget', basis: GADGET, models: [], fallback: [V('iPad / Android tab', 35000), V('iPad Air', 60000), V('iPad Pro', 100000)] },
  { re: /playstation|\bps ?5\b|xbox|nintendo|switch 2/i, brand: 'Gaming console', generic: true, kind: 'gadget', basis: GADGET, models: [], fallback: [V('Nintendo Switch', 35000), V('PS5 / Xbox', 55000), V('PS5 Pro', 75000)] },
  { re: /\bcamera\b|dslr|mirrorless|gopro/i, brand: 'Camera', generic: true, kind: 'gadget', basis: GADGET, models: [], fallback: [V('Action cam', 40000), V('Entry mirrorless kit', 70000), V('Pro body + lens', 250000)] },
  { re: /rolex/i, brand: 'Rolex', kind: 'watch', basis: 'Approx. Indian boutique price; popular steel models often have waiting lists.', models: [], fallback: [V('Oyster Perpetual', 650000), V('Datejust / Explorer', 900000), V('Submariner / GMT', 1300000)] },
  { re: /omega|tag heuer|tissot|seiko|apple watch|smartwatch|\bwatch\b/i, brand: 'Watch', generic: true, kind: 'watch', basis: GADGET, models: [
    { re: /apple watch/i, name: 'Apple Watch', variants: [V('SE', 25000), V('Series', 47000), V('Ultra', 90000)] },
  ], fallback: [V('Smartwatch', 25000), V('Swiss quartz (Tissot class)', 40000), V('Swiss automatic (TAG / Omega)', 400000)] },
];

/** Find the most specific match: model > brand. */
export function catalogLookup(text: string): { brand: CatalogBrand; model: CatalogModel | null } | null {
  const t = text || '';
  for (const b of CATALOG) {
    if (!b.re.test(t)) continue;
    const m = b.models.find((x) => x.re.test(t)) || null;
    return { brand: b, model: m };
  }
  return null;
}
