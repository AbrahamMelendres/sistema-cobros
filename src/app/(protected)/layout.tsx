import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre_completo")
    .eq("id", user.id)
    .single();

  const nombre = profile?.nombre_completo ?? user.email ?? "Usuario";

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <Navbar nombre={nombre} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
