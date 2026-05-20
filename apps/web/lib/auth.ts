import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "./supabase/config";
import { createClient } from "./supabase/server";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export async function requireUser(): Promise<AuthenticatedUser> {
  if (!hasSupabaseConfig()) {
    redirect(
      `/login?message=${encodeURIComponent("请先配置 Supabase 环境变量。")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    redirect("/login");
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
}
