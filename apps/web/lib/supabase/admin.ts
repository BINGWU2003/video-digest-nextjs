import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { supabaseUrl } from "./config";

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SupabaseAdminClient = ReturnType<typeof createSupabaseClient>;
type SupabaseClientOptions = NonNullable<
  Parameters<typeof createSupabaseClient>[2]
>;
type RealtimeTransport = NonNullable<
  NonNullable<SupabaseClientOptions["realtime"]>["transport"]
>;

let supabaseAdminClient: SupabaseAdminClient | null = null;

const websocketTransport = WebSocket as unknown as RealtimeTransport;

export function createAdminClient(): SupabaseAdminClient {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  supabaseAdminClient = createSupabaseClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: websocketTransport,
      },
    },
  );

  return supabaseAdminClient;
}
