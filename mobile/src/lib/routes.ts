// The server speaks in web paths (/goals, /insurance/market?category=motor …).
// This maps them to native screens, so moves, alerts and the assistant all open the right place.
import { WEB_URL } from './api';

const MAP: Record<string, string> = {
  '/': '/', '/dashboard': '/', '/overview': '/',
  '/goals': '/dreams', '/dreams': '/dreams',
  '/ask': '/ask', '/alerts': '/alerts', '/more': '/more',
  '/actions': '/actions', '/networth': '/networth', '/net-worth': '/networth',
  '/invest': '/invest', '/portfolio': '/invest',
  '/insurance': '/insurance', '/insurance/market': '/insurance/market',
  '/tax': '/tax', '/file': '/tax/file', '/file/self': '/tax/file',
  '/records': '/records', '/statement': '/statement', '/vault': '/vault',
  '/advisor': '/ca', '/ca': '/ca',
  '/markets': '/markets', '/reports': '/reports', '/plans': '/plans', '/settings': '/settings',
};
/** Pages that exist only on the web (printable documents) open in the in-app browser. */
const WEB_ONLY = ['/rent-receipts', '/donation-receipts', '/networth-statement'];

export function nativeRoute(webPath: string): { route?: string; web?: string } {
  const [path, qs] = String(webPath || '/').split('?');
  const clean = path.replace(/\/+$/, '') || '/';
  if (WEB_ONLY.includes(clean)) return { web: `${WEB_URL}${webPath}` };
  if (clean.startsWith('/advisor/')) return { route: `/ca/${clean.split('/')[2]}` };
  const r = MAP[clean];
  if (!r) return { route: '/' };
  return { route: qs ? `${r}?${qs}` : r };
}
