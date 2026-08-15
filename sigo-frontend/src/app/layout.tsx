import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIGO",
  icons: {
    icon: "/sigo-logo.ico",
  },
  description: "SIGO minimal admin frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
        <AuthProvider>
          {children}
          <footer className="border-t border-white/10 bg-[linear-gradient(90deg,#082b4d,#0a354e,#082b4d)] px-4 py-4 text-center text-xs font-medium text-blue-100">
            © 2026 SIGO. Todos os direitos reservados.
          </footer>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
