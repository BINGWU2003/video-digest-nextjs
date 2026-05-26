import { DashboardPage } from "../_components/dashboard-page";
import {
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
  type VideoRecordRow,
} from "@video-digest-nextjs/database";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const repository = createSupabaseVideoRecordsRepository(supabase);
  let records: VideoRecordRow[] = [];
  let databaseErrorMessage: string | undefined;

  try {
    records = await repository.listForUser({
      limit: 20,
      userId: user.id,
    });
  } catch (caught) {
    if (!isMissingDatabaseSchemaError(caught)) {
      throw caught;
    }

    databaseErrorMessage =
      "Supabase 数据表尚未创建。请先在 Supabase SQL Editor 执行 supabase/migrations/20260520213500_initial_video_digest_schema.sql。";
  }

  const resolvedSearchParams = await searchParams;

  return (
    <DashboardPage
      errorMessage={resolvedSearchParams?.error ?? databaseErrorMessage}
      records={records}
      userEmail={user.email}
    />
  );
}
