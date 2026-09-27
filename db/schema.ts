import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const questionBanks = sqliteTable(
  "question_banks",
  {
    userId: text("user_id").notNull(),
    subject: text("subject").notNull(),
    questionsJson: text("questions_json").notNull().default("[]"),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    userSubjectPk: primaryKey({ columns: [table.userId, table.subject] }),
  }),
);
