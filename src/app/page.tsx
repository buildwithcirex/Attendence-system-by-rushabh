import { redirect } from "next/navigation";
import { getSession } from "@/utils/session";
import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { GradientBackground } from "@/components/GradientBackground";

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0a]">
      <GradientBackground />

      <div className="w-full max-w-md glass-card rounded-2xl p-8 relative z-10 text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-white mb-2">E-Cell Portal</h1>
          <p className="text-muted font-light">Welcome to the attendance system</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="btn-primary w-full py-4 rounded-xl flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Login
          </Link>

          <Link
            href="/register"
            className="btn-secondary w-full py-4 rounded-xl flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
