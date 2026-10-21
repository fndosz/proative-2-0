import { signOut } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { isAdmin, requireUser } from "@/lib/authz";
import { ROLE_LABEL } from "@/lib/format";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <Sidebar
        userName={user.name ?? user.email}
        roleLabel={ROLE_LABEL[user.role]}
        isAdmin={isAdmin(user)}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
      <main className="px-4 py-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
