import { createServiceClient } from "./supabase/server";

export function serviceOrThrow() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase server env is missing.");
  return client;
}
