import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { tx, pdf, exp, sig } = req.query;

  // Check token not expired
  if (Date.now() > Number(exp)) {
    return res.status(403).send("Download link has expired. Please contact support.");
  }

  // Verify signature
  const expected = crypto
    .createHmac("sha256", process.env.DOWNLOAD_SECRET)
    .update(`${tx}:${pdf}:${exp}`)
    .digest("hex");

  if (sig !== expected) {
    return res.status(403).send("Invalid download link.");
  }

  // Get PDF filename from Supabase
  const { data: product } = await supabase
    .from("pdf_products")
    .select("filename, title")
    .eq("id", pdf)
    .single();

  if (!product) return res.status(404).send("Product not found.");

  // Generate a 5 minute signed URL from Supabase Storage
  const { data: signedUrl } = await supabase.storage
    .from("pdf-guides")
    .createSignedUrl(product.filename, 300);

  if (!signedUrl?.signedUrl) {
    return res.status(500).send("Could not generate download link.");
  }

  res.redirect(signedUrl.signedUrl);
}
