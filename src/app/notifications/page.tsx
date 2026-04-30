import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface NotificationRow {
  id: string;
  kind: string;
  payload: {
    po_id?: string;
    po_number?: string;
    project_id?: string;
    decision_note?: string;
  };
  read_at: string | null;
  created_at: string;
}

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="mt-4 text-red-600">Failed to load: {error.message}</p>
      </main>
    );
  }

  const rows = (data ?? []) as NotificationRow[];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Notifications</h1>
      {rows.length === 0 ? (
        <p className="mt-4 text-gray-600">No notifications yet.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {rows.map((n) => {
            const { po_id, po_number, decision_note } = n.payload ?? {};
            const isApproved = n.kind === "po.approved";
            return (
              <li key={n.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={n.read_at ? "text-gray-600" : "font-medium"}>
                      PO {po_number ?? "?"}{" "}
                      {isApproved ? "approved" : "rejected"}
                    </p>
                    {decision_note ? (
                      <p className="text-sm text-gray-600">
                        Reason: {decision_note}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-500">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {po_id ? (
                    <Link
                      className="text-sm text-blue-600 hover:underline"
                      href={`/pos/${po_id}`}
                    >
                      View
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
