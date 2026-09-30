import type { Candidate, Category, ExposureCounts, RelationLevel } from "./experience-match.ts";
export const WINDOW_SIZE = 1000;
export type Draw = { request_id: string; query_hash: string; deity_id: string; score: number; relation_level: RelationLevel; category: Category; created_at: number; message?: string | null };
export const SELECT_DRAW_SQL = `WITH recent AS (
 SELECT deity_id, count(*) AS recent_count FROM (SELECT deity_id FROM match_draws ORDER BY created_at DESC, rowid DESC LIMIT 1000) GROUP BY deity_id
), candidates AS (
 SELECT json_extract(value, '$.deity_id') AS deity_id, json_extract(value, '$.score') AS score,
 json_extract(value, '$.relation_level') AS relation_level, json_extract(value, '$.category') AS category FROM json_each(?)
)
INSERT INTO match_draws (request_id, query_hash, deity_id, score, relation_level, category, created_at)
SELECT ?, ?, c.deity_id, c.score, c.relation_level, c.category, ? FROM candidates c
LEFT JOIN recent r ON r.deity_id=c.deity_id LEFT JOIN deity_exposures e ON e.deity_id=c.deity_id
WHERE 1 ORDER BY coalesce(r.recent_count,0), coalesce(e.total_count,0), c.score DESC, random() LIMIT 1
ON CONFLICT(request_id) DO NOTHING`;
export const INCREMENT_SQL = `INSERT INTO deity_exposures (deity_id,total_count,last_shown)
SELECT deity_id,1,created_at FROM match_draws WHERE request_id=? AND changes()>0
ON CONFLICT(deity_id) DO UPDATE SET total_count=total_count+1,last_shown=excluded.last_shown`;
export async function readCounts(db: D1Database): Promise<ExposureCounts> {
  const result = await db.prepare(`WITH recent AS (SELECT deity_id,count(*) AS recent_count FROM
    (SELECT deity_id FROM match_draws ORDER BY created_at DESC,rowid DESC LIMIT 1000) GROUP BY deity_id)
    SELECT e.deity_id,e.total_count,e.last_shown,coalesce(r.recent_count,0) AS recent_count
    FROM deity_exposures e LEFT JOIN recent r ON r.deity_id=e.deity_id`).all<{ deity_id: string; total_count: number; last_shown: number; recent_count: number }>();
  return Object.fromEntries(result.results.map(({ deity_id, ...counts }) => [deity_id, counts]));
}
export async function readDraw(db: D1Database, requestId: string) {
  return db.prepare("SELECT * FROM match_draws WHERE request_id=?").bind(requestId).first<Draw>();
}
export async function recordDraw(db: D1Database, requestId: string, queryHash: string, pool: Array<Candidate & { category: Category }>, message?: string) {
  const results = await db.batch([
    db.prepare(SELECT_DRAW_SQL).bind(JSON.stringify(pool), requestId, queryHash, Date.now()), db.prepare(INCREMENT_SQL).bind(requestId),
    db.prepare("UPDATE match_draws SET message=? WHERE request_id=? AND query_hash=? AND message IS NULL").bind(message ?? null, requestId, queryHash),
    db.prepare("SELECT * FROM match_draws WHERE request_id=?").bind(requestId),
  ]);
  const draw = results[3].results[0] as unknown as Draw;
  if (!draw || draw.query_hash !== queryHash) throw new RequestConflictError();
  return { draw, replayed: Number(results[0].meta.changes) === 0 };
}
export class RequestConflictError extends Error {}
