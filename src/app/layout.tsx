import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Registro de Cobros",
  description: "Donde nace el conocimiento, florece un futuro sin límites.",
  icons: {
    icon: "/logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
