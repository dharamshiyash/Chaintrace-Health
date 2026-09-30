import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let client = null;
if (supabaseUrl && supabaseKey && typeof supabaseUrl === "string" && supabaseUrl.startsWith("http")) {
  try {
    client = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.warn("Notice: Failed to initialize Supabase client:", err.message);
  }
}

// Safe fallback proxy so calls to supabase.from(...)... don't throw TypeError if client is null
const dummyQueryBuilder = {
  select: () => dummyQueryBuilder,
  insert: () => dummyQueryBuilder,
  upsert: () => dummyQueryBuilder,
  update: () => dummyQueryBuilder,
  delete: () => dummyQueryBuilder,
  eq: () => dummyQueryBuilder,
  order: () => dummyQueryBuilder,
  limit: () => dummyQueryBuilder,
  single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
  then: (resolve) => resolve({ data: null, error: new Error("Supabase not configured") }),
};

export const supabase = client || {
  from: () => dummyQueryBuilder,
  channel: () => ({ on: () => ({ subscribe: () => {} }) }),
};

export async function withTimeout(promise, ms = 1500) {
  if (!promise || typeof promise.then !== "function") {
    return promise;
  }
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Supabase connection timeout")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}
