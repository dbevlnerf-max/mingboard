import { createClient } from "@supabase/supabase-js";


const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;


if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다."
  );
}


if (!supabaseSecretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY 환경변수가 없습니다."
  );
}


export const supabaseAdmin =
  createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );