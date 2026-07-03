import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { SessionProvider, type Role } from "@/components/session-context";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/crypto";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const payload = token ? await verifyToken(token) : null;
  if (!payload) {
    redirect("/login");
  }

  const userEmail   = payload.email;
  const role        = payload.role as Role;
  const isFullAdmin = role !== "MANAGER";

  return (
    <SessionProvider value={{ email: userEmail, role, isFullAdmin }}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* ── Glass sidebar ── */}
        <AppSidebar userEmail={userEmail} role={role} />

        {/* ── Main content column ── */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">

          {/* ── Topbar ── */}
          <header
            className={[
              "relative h-16 shrink-0",
              "bg-[hsl(225_30%_6%/0.65)] backdrop-blur-xl",
              "border-b border-white/[0.05]",
              "shadow-[0_1px_0_hsl(210_40%_98%/0.03)]",
            ].join(" ")}
          >
            {/* Subtle top-edge shine */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent pointer-events-none" />

            <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
              {/* Left — mobile menu + status */}
              <div className="flex items-center gap-3">
                <MobileNav userEmail={userEmail} role={role} />

                {/* Live indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/[0.15]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-glow" />
                  <span className="text-xs text-emerald-400 font-medium hidden sm:block">
                    Operational
                  </span>
                </div>
              </div>

              {/* Right — decorative glow dots */}
              <div className="flex items-center gap-2 opacity-40">
                <div className="h-1.5 w-1.5 rounded-full bg-[hsl(192_100%_58%)] pulse-glow" />
                <div className="h-1.5 w-1.5 rounded-full bg-[hsl(265_80%_68%)]" style={{ animationDelay: '0.5s' }} />
              </div>
            </div>
          </header>

          {/* ── Page content ── */}
          <main className="flex-1 overflow-auto animate-in">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
