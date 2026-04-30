import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  // Prove the server-side Supabase client constructs successfully.
  // We don't query anything yet — there's no schema and creds may be empty
  // during scaffold builds. Construction alone exercises the import + env wiring.
  let clientReady = false;
  try {
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      await createSupabaseServerClient();
      clientReady = true;
    }
  } catch {
    clientReady = false;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          purchaseer scaffold ready
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Next.js 15 + React 19 + Tailwind + Supabase SSR.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Server Supabase client:{" "}
          {clientReady ? "constructed" : "awaiting env vars"}
        </p>
      </div>
    </main>
  );
}
