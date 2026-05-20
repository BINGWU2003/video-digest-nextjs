import {
  hasSupabaseAdminConfig,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./config";

type SupabaseAdminUser = {
  email?: string;
};

type SupabaseAdminUsersResponse = {
  users?: SupabaseAdminUser[];
};

async function listAuthUsers(page: number, perPage: number) {
  const baseUrl = supabaseUrl!.replace(/\/$/, "");
  const response = await fetch(
    `${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
    {
      headers: {
        apikey: supabaseServiceRoleKey!,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase admin users request failed: ${response.status}`);
  }

  return (await response.json()) as SupabaseAdminUsersResponse;
}

export async function authUserExistsByEmail(email: string) {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  const normalizedEmail = email.toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (page <= 20) {
    try {
      const data = await listAuthUsers(page, perPage);
      const users = data.users ?? [];

      const exists = users.some(
        (user) => user.email?.toLowerCase() === normalizedEmail,
      );

      if (exists) {
        return true;
      }

      if (users.length < perPage) {
        return false;
      }

      page += 1;
    } catch (error) {
      console.error("Failed to check existing Supabase auth users.", error);
      return null;
    }
  }

  return false;
}
