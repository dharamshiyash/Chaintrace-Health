import { supabase } from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { function_name, tx_hash, gas_used, confirmation_ms, success } = req.body;

  if (!function_name) {
    return res.status(400).json({ error: "function_name is required" });
  }

  try {
    const { data, error } = await supabase
      .from("tx_performance")
      .insert([{ function_name, tx_hash, gas_used, confirmation_ms, success }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (error) {
    console.error("Error recording event performance:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
