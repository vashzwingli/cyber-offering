import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const deityExposures = sqliteTable("deity_exposures", {
  deityId: text("deity_id").primaryKey(), totalCount: integer("total_count").notNull().default(0), lastShown: integer("last_shown").notNull().default(0),
});
export const matchDraws = sqliteTable("match_draws", {
  requestId: text("request_id").primaryKey(), queryHash: text("query_hash").notNull(), deityId: text("deity_id").notNull(),
  score: integer("score").notNull(), relationLevel: text("relation_level").notNull(), category: text("category").notNull(), createdAt: integer("created_at").notNull(),
  message: text("message"),
}, (table) => [index("match_draws_created_at_idx").on(table.createdAt)]);
