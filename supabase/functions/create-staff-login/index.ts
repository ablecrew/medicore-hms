/// <reference path="../deno.d.ts" />
// =====================================================================
//  Edge Function: create-staff-login
//  Provision a Supabase auth login for an existing medicore.staff row.
//
//  Flow:
//    1. Verify the caller's JWT belongs to an admin.
//    2. Generate a strong temporary password.
//    3. Create the auth user (confirmed) with auth.admin.createUser().
//    4. Link staff.auth_user_id + upsert medicore.profiles.
//    5. Return the temp password so the admin can share it.
//
//  Deploy:
//    supabase functions deploy create-staff-login --no-verify-jwt
//
//  Why --no-verify-jwt? Because WE verify the JWT ourselves below (we need
//  to inspect claims + role). Without the flag, Supabase rejects requests
//  with no Authorization header. We then enforce auth inside the function.
//
//  Call from the client:
//    POST {FUNCTION_URL}  Headers: { Authorization: Bearer <user JWT> }
//    Body: { staffId: "STF-001" }   (or { staffId, password } to set your own)
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- password generator (strong, readable) ----
function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;
  // guarantee at least one of each class
  const required = [
    upper[cryptoRandom(upper.length)],
    lower[cryptoRandom(lower.length)],
    digits[cryptoRandom(digits.length)],
    symbols[cryptoRandom(symbols.length)],
  ];
  const rest = Array.from({ length: length - required.length }, () =>
    all[cryptoRandom(all.length)]
  );
  return shuffle([...required, ...rest]).join("");
}
function cryptoRandom(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoRandom(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return json({ error: "Missing authorization token" }, 401);
    }

    // ---- 1. Verify the caller's identity + admin role ----
    // Use a client scoped to the CALLER's JWT (RLS applies, so this is safe).
    const callerClient = createClient(SUPABASE_URL, ANON_KEY ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // Resolve the caller's role via the medicore.current_role() helper.
    const { data: callerRole, error: roleErr } = await callerClient
      .schema("medicore")
      .rpc("current_role");
    if (roleErr || callerRole !== "admin") {
      return json({ error: "Forbidden: admins only" }, 403);
    }

    // ---- 2. Parse the request ----
    const { staffId, password } = await req.json();
    if (!staffId || typeof staffId !== "string") {
      return json({ error: "staffId is required" }, 400);
    }

    // Fetch the staff row using the admin client (service role).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: staffRow, error: staffErr } = await admin
      .schema("medicore")
      .from("staff")
      .select("id, name, email, role, auth_user_id")
      .eq("id", staffId)
      .maybeSingle();
    if (staffErr) throw staffErr;
    if (!staffRow) {
      return json({ error: "Staff record not found" }, 404);
    }

    // If already linked, just reset the password instead of duplicating.
    let userId = staffRow.auth_user_id;
    const tempPassword = (typeof password === "string" && password.length >= 8)
      ? password
      : generatePassword(12);

    // ---- 3. Create (or update) the auth user ----
    // This is the critical step. The password is generated BEFORE this so we
    // can always return it.
    let userCreated = false;
    if (userId) {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        email_confirm: true,
      });
      if (updErr) {
        return json({ error: `Failed to reset password: ${updErr.message}` }, 500);
      }
      userCreated = true;
    } else {
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: staffRow.email,
        password: tempPassword,
        email_confirm: true, // auto-confirm so they can sign in immediately
        user_metadata: {
          full_name: staffRow.name,
          role: staffRow.role,
        },
      });
      if (createErr) {
        return json({ error: `Failed to create user: ${createErr.message}` }, 500);
      }
      userId = newUser.user.id;
      userCreated = true;
    }

    // ---- 4. Link staff + upsert profile (each isolated; never fatal) ----
    // The user already exists at this point, so these steps must NOT prevent
    // us from returning the password. We collect warnings instead.
    const warnings: string[] = [];

    // 4a. Link staff.auth_user_id
    try {
      const { error: linkErr } = await admin
        .schema("medicore")
        .from("staff")
        .update({ auth_user_id: userId })
        .eq("id", staffRow.id);
      if (linkErr) warnings.push(`staff link: ${linkErr.message}`);
    } catch (e) {
      warnings.push(`staff link: ${(e as Error).message}`);
    }

    // 4b. Upsert profile. Try normal upsert, then a plain insert as fallback.
    try {
      const { error: profileErr } = await admin
        .schema("medicore")
        .from("profiles")
        .upsert(
          { id: userId, email: staffRow.email, role: staffRow.role, full_name: staffRow.name },
          { onConflict: "id" }
        );
      if (profileErr) {
        warnings.push(`profile upsert: ${profileErr.message}`);
        // Fallback: plain insert (maybe the table has no PK conflict target).
        const { error: insErr } = await admin
          .schema("medicore")
          .from("profiles")
          .insert({ id: userId, email: staffRow.email, role: staffRow.role, full_name: staffRow.name });
        if (insErr) warnings.push(`profile insert: ${insErr.message}`);
      }
    } catch (e) {
      warnings.push(`profile: ${(e as Error).message}`);
    }

    console.log("[create-staff-login] done", { staffId: staffRow.id, userId, userCreated, warnings });

    // ---- 5. ALWAYS return the temp password for the admin to share ----
    return json({
      success: true,
      staffId: staffRow.id,
      userId,
      email: staffRow.email,
      tempPassword, // <- the field the client reads
      password: tempPassword, // <- alias for safety
      userCreated,
      warnings: warnings.length ? warnings : undefined,
      message: "Login created. Share these credentials securely.",
    });
  } catch (err) {
    console.error("[create-staff-login] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return json({ error: message }, 500);
  }
});
