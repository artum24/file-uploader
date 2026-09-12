import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { ScopeSection } from "@/components/ScopeSection";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-4 sm:p-8">
      <div className="flex w-full max-w-md items-center justify-between gap-2 lg:max-w-7xl">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-sand-900">Files</h1>
          <p className="truncate text-[13px] text-sand-400">
            Signed in as {session.user.email}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="shrink-0"
        >
          <button
            type="submit"
            className="whitespace-nowrap rounded-[10px] border border-sand-200 bg-white px-3.5 py-2 text-[13px] font-medium text-sand-700 transition hover:bg-sand-50"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-6 lg:max-w-7xl lg:grid-cols-2 lg:items-start">
        <ScopeSection scope="personal" title="My files" />
        <ScopeSection scope="shared" title="Shared files" />
      </div>
    </main>
  );
}
