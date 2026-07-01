// Context-aware sarcastic loading captions, keyed by app area. Used by the
// global route-transition curtain and by per-page loaders so the copy always
// matches wherever the user is heading.

export const GENERIC_QUIPS = [
  'Fetching your financial life…',
  'Doing money things, gracefully…',
  'One moment — making it make sense…',
  'Loading the boring bits so they look pretty…',
  'Counting rupees so you don’t have to…',
];

// Ordered: first matching prefix wins (put longer/more specific paths first).
const ROUTE_QUIPS: [string, string[]][] = [
  ['/dashboard', [
    'Piecing together your money picture…',
    'Warming up your financial dashboard…',
    'Tallying the good news and the to-dos…',
    'Checking your Money Health, gently…',
  ]],
  ['/ask', [
    'Waking up your money brain…',
    'Reading your numbers before you ask…',
    'Thinking in rupees and percentages…',
    'Loading answers, minus the jargon…',
  ]],
  ['/alerts', [
    'Rounding up things worth your attention…',
    'Checking what needs you today…',
    'Sorting the urgent from the “eh, later”…',
  ]],
  ['/actions', [
    'Rounding up ways to make you richer…',
    'Finding money you forgot you had…',
    'Ranking your to-dos so you don’t have to…',
    'Bribing your future self to save more…',
  ]],
  ['/goals', [
    'Mapping the road to your goals…',
    'Doing the “can I afford this?” math…',
    'Turning dreams into monthly numbers…',
  ]],
  ['/networth-statement', [
    'Drafting your net-worth statement…',
    'Making your balance sheet presentable…',
    'Putting assets and liabilities on paper…',
  ]],
  ['/networth', [
    'Adding up everything you own (and owe)…',
    'Counting assets, ignoring vibes…',
    'Projecting future-you’s bank balance…',
  ]],
  ['/invest', [
    'Diversifying without the jargon…',
    'Turning today’s surplus into future-you…',
    'Balancing greed and fear, mathematically…',
    'Finding your risk appetite… gently…',
  ]],
  ['/markets', [
    'Fetching news that actually matters…',
    'Ignoring the doom, keeping the signal…',
    'Sorting facts from finfluencer noise…',
  ]],
  ['/tax', [
    'Finding deductions the taxman forgot to mention…',
    'Arguing old regime vs new on your behalf…',
    'Counting every rupee back into your pocket…',
    'Making peace with Form 16…',
  ]],
  ['/file', [
    'Lining up your ITR paperwork…',
    'Working out which ITR form is yours…',
    'Getting your filing checklist ready…',
  ]],
  ['/insurance/market', [
    'Comparing insurers who’d rather you didn’t…',
    'Checking who actually pays their claims…',
    'Working out how much “peace of mind” costs…',
    'Ranking plans by more than just ads…',
  ]],
  ['/insurance', [
    'Reading the fine print so you don’t have to…',
    'Sizing your cover, not overselling it…',
    'Separating real protection from sales pitches…',
  ]],
  ['/advisor', [
    'Connecting you with your CA…',
    'Opening the line to your advisor…',
    'Loading your shared workspace…',
  ]],
  ['/records', [
    'Filing your documents neatly…',
    'Reading paperwork so you don’t have to…',
    'Sorting a year of statements…',
  ]],
  ['/statement', [
    'Making sense of your spending…',
    'Finding where the money actually went…',
    'Hunting for “where could I have saved?”…',
  ]],
  ['/vault', [
    'Unlocking your document vault…',
    'Keeping your papers safe and sorted…',
    'Encrypting, storing, tidying…',
  ]],
  ['/reports', [
    'Assembling your money story…',
    'Making your numbers look presentable…',
    'Turning data into bragging rights…',
  ]],
  ['/plans', [
    'Lining up what PayWatch Plus unlocks…',
    'Doing the “is it worth it?” math…',
    'Loading the good stuff…',
  ]],
  ['/settings', [
    'Loading your details…',
    'Fetching your profile and preferences…',
    'Tidying your settings…',
  ]],
  ['/rent-receipts', [
    'Generating your rent receipts…',
    'Formatting HRA proof, the tidy way…',
  ]],
];

export function quipsForPath(path: string | null): string[] {
  if (!path) return GENERIC_QUIPS;
  for (const [prefix, quips] of ROUTE_QUIPS) {
    if (path.startsWith(prefix)) return quips;
  }
  return GENERIC_QUIPS;
}
