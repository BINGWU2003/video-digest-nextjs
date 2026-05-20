import { createClient } from "@supabase/supabase-js";

import {
  hasSupabaseAdminConfig,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./config";

export function createAdminClient() {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  return createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function authUserExistsByEmail(email: string) {
  const supabase = createAdminClient();

  if (!supabase) {
    return null;
  }

  const normalizedEmail = email.toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Failed to check existing Supabase auth users.", error);
      return null;
    }

    const exists = data.users.some(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );

    if (exists) {
      return true;
    }

    if (data.users.length < perPage) {
      return false;
    }

    page += 1;
  }

  return false;
}
