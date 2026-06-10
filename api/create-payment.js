export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();

  const { pdf_id, email, title, amount } = req.body;
  const tx_ref = "dk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

  const response = await fetch("https://api.paychangu.com/payment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYCHANGU_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "MWK",
      tx_ref,
      email,
      callback_url: `${process.env.SITE_URL}/verify-payment?tx_ref=${tx_ref}&pdf_id=${pdf_id}`,
      return_url: `${process.env.SITE_URL}/verify-payment?tx_ref=${tx_ref}&pdf_id=${pdf_id}`,
      customization: {
        title,
        description: "PDF Guide by Digitalkuwala",
      },
      meta: { pdf_id, email },
    }),
  });

  const data = await response.json();
  if (!data?.data?.checkout_url) {
    return res.status(500).json({ error: "Could not create checkout" });
  }
  res.json({ checkout_url: data.data.checkout_url, tx_ref });
}
