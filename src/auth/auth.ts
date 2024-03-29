import { createClient, SupabaseClient } from "@supabase/supabase-js";

export default class Auth {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

}
