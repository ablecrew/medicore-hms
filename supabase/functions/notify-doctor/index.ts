/// <reference path="../deno.d.ts" />
// =====================================================================
//  Edge Function: notify-doctor
//  Sends an appointment notification email to the doctor.
//
//  Uses Resend (https://resend.com) if RESEND_API_KEY is set, else
//  simulates and returns success (for the demo).
//
//  Deploy: supabase functions deploy notify-doctor --no-verify-jwt
//  Secret: supabase secrets set RESEND_API_KEY=re_xxx  (optional)
//  From:   supabase secrets set MAIL_FROM=MediCore <noreply@medicore.co.ke>
//
//  Client call:
//    POST {URL}/functions/v1/notify-doctor
//    Headers: Authorization Bearer <jwt>, apikey
//    Body: { doctorEmail, doctorName, patientName, date, time, reason, type }
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "MediCore HMS <noreply@medicore.co.ke>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Verify caller is a logged-in staff member.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing authorization token" }, 401);

    const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const { doctorEmail, doctorName, patientName, date, time, reason, type } = await req.json();
    if (!doctorEmail) return json({ error: "doctorEmail required" }, 400);

    const subject = `New Appointment — ${patientName} on ${date} at ${time}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:24px">
        <div style="background:linear-gradient(135deg,#1E88E5,#64B5F6);padding:20px;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0">MediCore — New Appointment</h2>
        </div>
        <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
          <p style="font-size:16px;color:#0f172a">Hello Dr. ${doctorName || ""},</p>
          <p style="color:#475569">A new appointment has been booked with you:</p>
          <table style="width:100%;margin:16px 0;color:#334155">
            <tr><td style="padding:6px 0;color:#64748b">Patient</td><td style="font-weight:600">${patientName}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Date</td><td style="font-weight:600">${date}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Time</td><td style="font-weight:600">${time}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Type</td><td style="font-weight:600">${type || "Consultation"}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Reason</td><td>${reason || "—"}</td></tr>
          </table>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">This is an automated message from MediCore HMS.</p>
        </div>
      </div>`;

    // If Resend key configured, send real email; otherwise simulate.
    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: MAIL_FROM, to: [doctorEmail], subject, html }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("[notify-doctor] Resend error:", err);
        return json({ success: false, simulated: false, error: err }, 502);
      }
      return json({ success: true, simulated: false, message: `Email sent to ${doctorEmail}` });
    }

    // Simulated (no provider configured).
    console.log(`[notify-doctor] SIMULATED email -> ${doctorEmail}: ${subject}`);
    return json({ success: true, simulated: true, message: `Email queued (simulated) for ${doctorEmail}` });
  } catch (err) {
    console.error("[notify-doctor] error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
