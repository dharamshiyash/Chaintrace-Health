import { contract } from "../_lib/contract.js";
import { supabase } from "../_lib/supabase.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Fetch all batch hashes from chain
    let allHashes = [];
    try {
      allHashes = await contract.getAllBatchHashes();
    } catch (err) {
      console.warn("Failed to fetch batch hashes from blockchain:", err.message);
      return res.status(200).json([]);
    }

    if (!allHashes || allHashes.length === 0) {
      return res.status(200).json([]);
    }

    // 2. For each, call getDivergencePoint; collect firstUnauthorized addresses
    const tally = {};

    await Promise.all(
      allHashes.map(async (hash) => {
        try {
          const [, firstUnauth] = await contract.getDivergencePointByHash(hash);
          if (firstUnauth && firstUnauth !== ZERO_ADDRESS) {
            const key = firstUnauth.toLowerCase();
            tally[key] = (tally[key] || 0) + 1;
          }
        } catch {
          // Batch may not have divergence; skip silently
        }
      })
    );

    if (Object.keys(tally).length === 0) {
      return res.status(200).json([]);
    }

    // 3. Look up org names from Supabase (best-effort)
    const addresses = Object.keys(tally);
    let orgMap = {};

    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("address, org_name")
        .in("address", addresses);

      if (profiles) {
        profiles.forEach((p) => {
          orgMap[p.address.toLowerCase()] = p.org_name;
        });
      }
    } catch (err) {
      console.warn("Failed to fetch org names from Supabase:", err.message);
    }

    // 4. Build + sort ranked list
    const ranked = Object.entries(tally)
      .map(([address, count], i) => ({
        rank: i + 1,
        address,
        orgName: orgMap[address] || "Unknown Organization",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    return res.status(200).json(ranked);
  } catch (error) {
    console.error("Error fetching offenders:", error);
    return res.status(200).json([]); // Graceful degradation — return empty instead of 500
  }
}
