import { supabase } from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.params?.id || req.query?.id;

  try {
    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("batch_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Batch not found" });
      }
      throw error;
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error(`Error fetching batch ${id}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
