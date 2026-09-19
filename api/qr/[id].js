import QRCode from "qrcode";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.params?.id || req.query?.id;
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.VITE_APP_URL || "http://localhost:5173";

  const verifyUrl = `${baseUrl}/verify/${id}`;

  try {
    const png = await QRCode.toBuffer(verifyUrl, {
      errorCorrectionLevel: "M",
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#1A1A1A", light: "#FAFAF8" },
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="ChainTrace-QR-${id}.png"`);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).send(png);
  } catch (error) {
    console.error(`Error generating QR for ${id}:`, error);
    return res.status(500).json({ error: "Failed to generate QR code" });
  }
}
