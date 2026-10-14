import { AdminChat } from "@/components/admin-chat";
import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { loadRoster } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  await requireOwner();
  const { rows } = await loadRoster();
  const models = rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      companyName: row.companyName,
      logoUrl: row.logoUrl,
      enabled: row.enabled,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return (
    <div className="stack">
      <SectionNav />
      <h1>Chat</h1>
      <p className="muted">
        Pick a roster model and talk to it the same way a round does. The thread stays on this page. It is not saved,
        and it does not count as a game. Show tokens or Show input on a reply to see the counts or the text that was sent.
      </p>
      <AdminChat models={models} />
    </div>
  );
}
