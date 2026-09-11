export { auth as middleware } from "@/auth";

export const config = {
  // Protect everything under /dashboard; add more prefixes as features are added.
  matcher: ["/dashboard/:path*"],
};
