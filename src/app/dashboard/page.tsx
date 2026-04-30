import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CompanyDashboardClient } from "./CompanyDashboardClient";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-4">
        <h1 className="text-xl font-semibold sm:text-2xl">Company dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live across all projects. Updates every 5s while the tab is visible.
        </p>
      </header>
      <CompanyDashboardClient />
    </main>
  );
}
