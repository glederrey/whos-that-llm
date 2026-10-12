import { requireOwner } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return children;
}
