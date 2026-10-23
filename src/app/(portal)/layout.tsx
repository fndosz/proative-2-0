import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { PageUpdated } from "@/components/page-updated";
import { isAdmin, requireUser } from "@/lib/authz";
import { fmtDateTime, ROLE_LABEL } from "@/lib/format";

const BUILD = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
  sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "local",
  builtAt: fmtDateTime(process.env.NEXT_PUBLIC_BUILD_TIME ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME) : null),
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const theme = ((await cookies()).get("theme")?.value ?? "system") as "light" | "dark" | "system";
  return (
    <div className="min-h-screen">
      <Sidebar
        userName={user.name ?? user.email}
        roleLabel={ROLE_LABEL[user.role]}
        isAdmin={isAdmin(user)}
        avatarUrl={user.image ? `/api/avatar/${user.id}?v=${user.updatedAt.getTime()}` : null}
        theme={theme}
        build={BUILD}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
      <main className="px-4 py-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <PageUpdated renderedAt={new Date().toISOString()} />
          {children}
        </div>
      </main>
    </div>
  );
}
