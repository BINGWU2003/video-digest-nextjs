import { DashboardPage } from "../_components/dashboard-page";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();

  return <DashboardPage userEmail={user.email} />;
}
