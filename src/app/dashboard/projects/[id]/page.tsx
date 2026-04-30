import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProjectDashboardClient } from "./ProjectDashboardClient";

export const dynamic = "force-dynamic";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-4">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
          &larr; Company dashboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Project dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Updates every 5s while the tab is visible.
        </p>
      </header>
      <ProjectDashboardClient projectId={id} />
    </main>
  );
}
