import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { tx_ref, pdf_id } = req.query;
  if (!tx_ref || !pdf_id) return res.status(400).json({ error: "Missing params" });

  // Verify with PayChangu
  const verify = await fetch(`https://api.paychangu.com/verify-payment/${tx_ref}`, {
    headers: { Authorization: `Bearer ${process.env.PAYCHANGU_SECRET}` },
  });
  const result = await verify.json();
  const payment = result?.data;

  if (!payment || payment.status !== "success") {
    return res.json({ success: false, message: "Payment not confirmed" });
  }

  // Get PDF record to check expected amount
  const { data: pdf } = await supabase
    .from("pdf_products")
    .select("*")
    .eq("id", pdf_id)
    .single();

  if (!pdf || payment.amount < pdf.price) {
    return res.json({ success: false, message: "Amount mismatch" });
  }

  // Save purchase record
  await supabase.from("purchases").upsert({
    tx_ref,
    email: payment.authorization?.mobile_number || "unknown",
    pdf_id,
    amount: payment.amount,
    status: "success",
  });

  // Generate signed download token valid for 15 minutes
  const expiry = Date.now() + 15 * 60 * 1000;
  const sig = crypto
    .createHmac("sha256", process.env.DOWNLOAD_SECRET)
    .update(`${tx_ref}:${pdf_id}:${expiry}`)
    .digest("hex");

  res.json({
    success: true,
    download_url: `/api/download?tx=${tx_ref}&pdf=${pdf_id}&exp=${expiry}&sig=${sig}`,
    title: pdf.title,
  });
}
