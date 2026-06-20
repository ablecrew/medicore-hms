/// <reference path="../deno.d.ts" />
// =====================================================================
//  Edge Function: mpesa-stk-push
//  Initiates an M-Pesa STK Push payment via Safaricom Daraja API.
//
//  Prerequisites (set as Supabase secrets):
//    MPESA_CONSUMER_KEY=your_app_consumer_key
//    MPESA_CONSUMER_SECRET=your_app_consumer_secret
//    MPESA_SHORTCODE=your_paybill_or_till_number
//    MPESA_PASSKEY=your_passkey
//    MPESA_CALLBACK_URL=https://your-project.supabase.co/functions/v1/mpesa-callback
//
//  Without secrets, the function SIMULATES a successful STK push (for demo).
//
//  Deploy: supabase functions deploy mpesa-stk-push --no-verify-jwt
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY");
const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET");
const SHORTCODE = Deno.env.get("MPESA_SHORTCODE") ?? "174379";
const PASSKEY = Deno.env.get("MPESA_PASSKEY") ?? "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const CALLBACK_URL = Deno.env.get("MPESA_CALLBACK_URL") ?? "https://example.com/callback";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: cors });

function getPassword(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

async function getAccessToken(): Promise<string | null> {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) return null;
  try {
    const auth = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
    const res = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` },
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { phone, amount, invoiceId, receiptNumber } = await req.json();
    if (!phone || !amount) return json({ error: "phone and amount required" }, 400);

    // Format phone: convert 07XX / 2547XX to 2547XX
    let formattedPhone = phone.replace(/\s/g, "");
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1);
    if (formattedPhone.startsWith("+254")) formattedPhone = formattedPhone.slice(1);

    const token = await getAccessToken();

    // If no Daraja credentials, SIMULATE the STK push
    if (!token) {
      console.log(`[mpesa-stk-push] SIMULATED STK push -> ${formattedPhone}: KES ${amount} for ${invoiceId}`);
      // Simulate payment success after 3 seconds
      setTimeout(async () => {
        try {
          const admin = await import("https://esm.sh/@supabase/supabase-js@2").then(m => m.createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } }));
          // Record the payment
          await admin.schema("medicore").from("payments").insert({
            invoice_id: invoiceId,
            receipt_number: receiptNumber,
            amount: Number(amount),
            method: "M-Pesa",
            reference: `SIM-${Date.now()}`,
            phone: formattedPhone,
            status: "Completed",
          });
          // Check if invoice is fully paid
          const { data: payments } = await admin.schema("medicore").from("payments").select("amount").eq("invoice_id", invoiceId).eq("status", "Completed");
          const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
          const { data: inv } = await admin.schema("medicore").from("invoices").select("total_amount").eq("id", invoiceId).maybeSingle();
          if (inv && totalPaid >= Number(inv.total_amount)) {
            await admin.schema("medicore").from("invoices").update({ status: "Paid", paid_at: new Date().toISOString(), payment_method: "M-Pesa" }).eq("id", invoiceId);
          }
          console.log(`[mpesa-stk-push] SIMULATED payment completed for ${invoiceId}: KES ${amount}`);
        } catch (e) {
          console.error("[mpesa-stk-push] simulated callback error:", e);
        }
      }, 3000);

      return json({
        success: true,
        simulated: true,
        message: "STK push sent (simulated). Payment will auto-complete in 3 seconds.",
        merchantRequestId: "sim-" + Date.now(),
        checkoutRequestId: "sim-checkout-" + Date.now(),
      });
    }

    // REAL Daraja STK Push
    const password = getPassword();
    const timestamp = getTimestamp();

    const res = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Number(amount),
        PartyA: formattedPhone,
        PartyB: SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: CALLBACK_URL,
        AccountReference: invoiceId,
        TransactionDesc: `Payment for ${invoiceId}`,
      }),
    });

    const data = await res.json();

    if (data.ResponseCode === "0") {
      // Store checkout_request_id for callback matching
      const admin = await import("https://esm.sh/@supabase/supabase-js@2").then(m => m.createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } }));
      await admin.schema("medicore").from("payments").insert({
        invoice_id: invoiceId,
        receipt_number: receiptNumber,
        amount: Number(amount),
        method: "M-Pesa",
        phone: formattedPhone,
        checkout_request_id: data.CheckoutRequestID,
        status: "Pending",
      });

      return json({
        success: true,
        simulated: false,
        message: "STK push sent. Enter your M-Pesa PIN to complete.",
        checkoutRequestId: data.CheckoutRequestID,
      });
    } else {
      return json({ success: false, error: data.errorMessage || "STK push failed" }, 400);
    }
  } catch (err) {
    console.error("[mpesa-stk-push] error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
