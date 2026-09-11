import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">File Uploader</h1>
      <p className="text-sm text-gray-500">
        Private storage for the family. Sign in with an allowed Google
        account.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white transition hover:bg-gray-800"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
