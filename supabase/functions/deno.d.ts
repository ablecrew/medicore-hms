/* =====================================================================
   Ambient types for Supabase Edge Functions (Deno runtime).

   This file is referenced via a triple-slash directive at the top of each
   function AND included by supabase/tsconfig.json. It gives the editor
   type info for Deno globals + the https:// imports that Deno resolves at
   runtime but Node/Vite cannot see.
   ===================================================================== */

/* ---- 1. Deno runtime globals (typed as a const object) ---- */
declare const Deno: {
    readonly env: {
      get(key: string): string | undefined;
      toObject(): Record<string, string>;
    };
    serve(
      handler: (request: Request) => Response | Promise<Response>
    ): void;
    readonly version: { deno: string; v8: string; typescript: string };
    readFileSync(path: string | URL): Uint8Array;
    readTextFileSync(path: string | URL): string;
    writeFileSync(path: string | URL, data: Uint8Array): void;
  };
  
  /* ---- 2. Typed re-export for the Supabase JS URL import ----
     Deno fetches this URL at runtime; in the editor we re-export the REAL
     types from the locally-installed @supabase/supabase-js package. */
  declare module "https://esm.sh/@supabase/supabase-js@2" {
    export * from "@supabase/supabase-js";
  }
  
  /* ---- 3. Catch-all for any other https:// URL imports (resolves to any) ---- */
  declare module "https://*";
  declare module "http://*";
  