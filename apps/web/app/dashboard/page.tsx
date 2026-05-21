import { DashboardPage } from "../_components/dashboard-page";
import { createSupabaseVideoRecordsRepository } from "@repo/database";
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
  const records = await repository.listForUser({
    limit: 20,
    userId: user.id,
  });
  const resolvedSearchParams = await searchParams;

  return (
    <DashboardPage
      errorMessage={resolvedSearchParams?.error}
      records={records}
      userEmail={user.email}
    />
  );
}
