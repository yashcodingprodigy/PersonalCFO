// Server-Sent Events (SSE) for instant updates. Each logged-in user/CA holds
// one open connection keyed by their id; when something relevant happens
// (a message, a connection request/approval) the server pushes a tiny "ping"
// to the affected party, and the client refetches. Lightweight: we push a
// signal, not the data. In-memory registry (single Railway instance is fine;
// move to Redis pub/sub if we ever scale horizontally).
import type { Response } from 'express';

const clients = new Map<string, Set<Response>>();

export function addClient(subjectId: string, res: Response) {
  if (!clients.has(subjectId)) clients.set(subjectId, new Set());
  clients.get(subjectId)!.add(res);
}
export function removeClient(subjectId: string, res: Response) {
  const set = clients.get(subjectId);
  if (set) { set.delete(res); if (set.size === 0) clients.delete(subjectId); }
}
export function publish(subjectId: string, event = 'refresh') {
  const set = clients.get(subjectId);
  if (!set) return;
  for (const res of set) {
    try { res.write(`data: ${event}\n\n`); } catch { /* dead connection, cleaned on close */ }
  }
}
