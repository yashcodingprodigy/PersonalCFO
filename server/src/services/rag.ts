// Local RAG store — the personalisation layer of Ask Your CFO.
//
// Design: every user has a private document store inside PostgreSQL
// (rag_documents with user_id) alongside a global knowledge base
// (user_id IS NULL: tax law summaries, planning rules, SEBI/IRDAI
// guidelines). Retrieval runs locally via Postgres full-text search —
// no user data is sent to any embedding API.
//
// The system "learns" each user over time: every question asked, every
// action completed/skipped, and every transaction-category correction is
// written back into the user's private store, so future retrievals are
// grounded in that user's own history. Swapping FTS for pgvector +
// local embeddings is a drop-in upgrade (same table, add a vector column).

import { query } from '../db';

export interface RetrievedDoc {
  doc_id: string;
  kind: string;
  title: string;
  content: string;
  source_tag: string;
  rank: number;
  scope: 'global' | 'personal';
}

export async function retrieve(userId: string, queryText: string, limit = 6): Promise<RetrievedDoc[]> {
  const cleaned = queryText.replace(/[^a-zA-Z0-9₹%.\s]/g, ' ').trim();
  if (!cleaned) return [];
  const rows = await query<RetrievedDoc & { user_id: string | null }>(
    `SELECT doc_id, kind, title, content, source_tag, user_id,
            ts_rank(tsv, websearch_to_tsquery('english', $2)) AS rank
       FROM rag_documents
      WHERE (user_id IS NULL OR user_id = $1)
        AND tsv @@ websearch_to_tsquery('english', $2)
      ORDER BY rank DESC
      LIMIT $3`,
    [userId, cleaned, limit]
  );
  return rows.map((r) => ({ ...r, scope: r.user_id ? 'personal' : 'global' }));
}

// Write a memory into the user's private store. Used by:
//  - Q&A (questions asked + topics)
//  - Action engine (completions, skips — reveals preferences)
//  - Transaction corrections (personal categorisation model)
export async function remember(userId: string, kind: string, title: string, content: string, sourceTag = 'Your history') {
  await query(
    `INSERT INTO rag_documents (user_id, kind, title, content, source_tag) VALUES ($1,$2,$3,$4,$5)`,
    [userId, kind, title, content, sourceTag]
  );
  // Keep the personal store bounded: retain the most recent 500 memories
  await query(
    `DELETE FROM rag_documents WHERE user_id = $1 AND doc_id IN (
       SELECT doc_id FROM rag_documents WHERE user_id = $1
       ORDER BY created_at DESC OFFSET 500)`,
    [userId]
  );
}

// Idempotent + incremental: inserts any global doc whose title isn't already
// present, and refreshes the content/tag of ones that are. Safe to re-run, so
// adding new knowledge is just "edit the seed list and run npm run seed again".
export async function seedGlobalKnowledge(docs: { kind: string; title: string; content: string; source_tag: string }[]) {
  const existing = await query<{ title: string }>(`SELECT title FROM rag_documents WHERE user_id IS NULL`);
  const have = new Set(existing.map((r) => r.title));
  let added = 0;
  for (const d of docs) {
    if (have.has(d.title)) {
      // keep existing content fresh if it changed
      await query(
        `UPDATE rag_documents SET kind=$1, content=$2, source_tag=$3 WHERE user_id IS NULL AND title=$4`,
        [d.kind, d.content, d.source_tag, d.title]
      );
    } else {
      await query(
        `INSERT INTO rag_documents (user_id, kind, title, content, source_tag) VALUES (NULL,$1,$2,$3,$4)`,
        [d.kind, d.title, d.content, d.source_tag]
      );
      added++;
    }
  }
  return added; // number of new docs inserted (0 if all already present)
}
