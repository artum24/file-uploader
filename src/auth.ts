import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Comma-separated list of emails allowed to sign in, e.g.:
 * ALLOWED_EMAILS=you@gmail.com,partner@gmail.com
 */
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      if (allowedEmails.length === 0) {
        console.warn(
          "ALLOWED_EMAILS is empty — no one will be able to sign in. Set it in .env.local."
        );
        return false;
      }

      return allowedEmails.includes(user.email.toLowerCase());
    },
  },
});
