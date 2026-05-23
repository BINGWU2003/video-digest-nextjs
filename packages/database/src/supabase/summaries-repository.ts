import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateSummaryInput,
  SummariesRepository,
} from "../repositories/summaries.js";
import type { SummaryRow } from "../tables.js";
import { DatabaseQueryError } from "./database-query-error.js";

type SupabaseSummaryRow = {
  id: string;
  record_id: string;
  user_id: string;
  language: string;
  format: SummaryRow["format"];
  title: string | null;
  short_summary: string | null;
  key_points: unknown;
  timeline: unknown;
  takeaways: unknown;
  markdown: string | null;
  model: string | null;
  prompt_version: string | null;
  created_at: string;
};

type SupabaseCreateSummaryInput = {
  record_id: string;
  user_id: string;
  language: string;
  format: SummaryRow["format"];
  title: string | null;
  short_summary: string | null;
  key_points: unknown[];
  timeline: unknown[];
  takeaways: unknown[];
  markdown: string | null;
  model: string | null;
  prompt_version: string | null;
};

export function createSupabaseSummariesRepository(
  client: SupabaseClient,
): SummariesRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from("summaries")
        .insert(toSupabaseCreateInput(input))
        .select("*")
        .single();

      if (error) {
        throw new DatabaseQueryError("创建摘要记录失败。", error);
      }

      if (!data) {
        throw new DatabaseQueryError("创建摘要记录失败：数据库未返回记录。", null);
      }

      return mapSummaryRow(data as SupabaseSummaryRow);
    },

    async findLatestForRecord(input) {
      const { data, error } = await client
        .from("summaries")
        .select("*")
        .eq("record_id", input.recordId)
        .eq("user_id", input.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new DatabaseQueryError("查询摘要记录失败。", error);
      }

      return data ? mapSummaryRow(data as SupabaseSummaryRow) : null;
    },
  };
}

function toSupabaseCreateInput(
  input: CreateSummaryInput,
): SupabaseCreateSummaryInput {
  return {
    record_id: input.recordId,
    user_id: input.userId,
    language: input.language,
    format: input.format,
    title: input.title,
    short_summary: input.shortSummary,
    key_points: input.keyPoints,
    timeline: input.timeline,
    takeaways: input.takeaways,
    markdown: input.markdown,
    model: input.model,
    prompt_version: input.promptVersion,
  };
}

function mapSummaryRow(row: SupabaseSummaryRow): SummaryRow {
  return {
    id: row.id,
    recordId: row.record_id,
    userId: row.user_id,
    language: row.language,
    format: row.format,
    title: row.title,
    shortSummary: row.short_summary,
    keyPoints: toArray(row.key_points),
    timeline: toArray(row.timeline),
    takeaways: toArray(row.takeaways),
    markdown: row.markdown,
    model: row.model,
    promptVersion: row.prompt_version,
    createdAt: new Date(row.created_at),
  };
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
