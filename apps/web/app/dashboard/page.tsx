import { DashboardPage } from "../_components/dashboard-page";
import {
  createSupabaseEmailAddressesRepository,
  createSupabaseVideoRecordsRepository,
  type EmailAddressRow,
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
  const emailAddressesRepository =
    createSupabaseEmailAddressesRepository(supabase);
  let emailAddresses: EmailAddressRow[] = [];
  let records: VideoRecordRow[] = [];
  let databaseErrorMessage: string | undefined;

  try {
    [records, emailAddresses] = await Promise.all([
      repository.listForUser({
        limit: 20,
        userId: user.id,
      }),
      emailAddressesRepository.listForUser({
        userId: user.id,
      }),
    ]);
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
      emailAddresses={emailAddresses}
      errorMessage={resolvedSearchParams?.error ?? databaseErrorMessage}
      records={records}
      userEmail={user.email}
    />
  );
}
