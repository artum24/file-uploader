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
      <div className="flex w-full max-w-md items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="truncate text-sm text-gray-600">
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
            className="whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition hover:bg-gray-50"
          >
            Sign out
          </button>
        </form>
      </div>

      <ScopeSection scope="personal" title="Мої файли" />
      <ScopeSection scope="shared" title="Спільні файли" />
    </main>
  );
}
