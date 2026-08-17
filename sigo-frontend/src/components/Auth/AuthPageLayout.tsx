import type { ReactNode } from "react";
import Image from "next/image";
import { NavBar } from "@/components/Sidebar/NavBar";

type AuthPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
};

export function AuthPageLayout({
  eyebrow,
  title,
  description,
  children,
  wide = false,
}: AuthPageLayoutProps) {
  return (
    <div className="sigo-page">
      <NavBar />
      <main className="sigo-shell flex min-h-[calc(100vh-5rem)] items-center justify-center py-8 lg:py-12">
        <div className={`grid w-full overflow-hidden rounded-2xl border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-lg)] lg:divide-x lg:divide-[var(--sigo-border)] ${
          wide
            ? "max-w-6xl lg:grid-cols-[0.85fr_1.45fr]"
            : "max-w-5xl lg:grid-cols-[1.2fr_1fr]"
        }`}>
          <section className="hidden flex-col justify-between bg-[linear-gradient(to_bottom_right,rgba(8,47,99,0.95),rgba(7,95,189,0.85)),url('https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&q=80')] bg-cover bg-center p-10 text-white lg:flex">
            <div className="max-w-xl">
              <div className="mb-6 flex h-32 w-32 items-center justify-center">
                <Image
                  src="/sigo-logo.png"
                  alt="Logo SIGO"
                  width={128}
                  height={128}
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="sigo-public-hero-title mt-4 text-lg font-bold text-white">
                Oficina, clientes e serviços em um só painel
              </p>
              <p className="mt-4 max-w-lg text-base leading-7 text-blue-50">
                Acesse o ambiente administrativo para acompanhar cadastros,
                pedidos, veículos, peças e serviços com clareza operacional.
              </p>
            </div>
          </section>

          <section className="flex flex-col bg-white">
            <header className="border-b border-[var(--sigo-border)] px-6 py-8 sm:px-8">
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--sigo-blue-deep)] p-2 shadow-sm">
                  <Image
                    src="/sigo-logo.png"
                    alt="Logo SIGO"
                    width={80}
                    height={80}
                    className="h-full w-full object-contain"
                  />
                </span>
                <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                  Sistema de gestão de oficinas
                </p>
              </div>

              <p className="text-sm font-bold text-[var(--sigo-blue)]">{eyebrow}</p>
              <h1 className="mt-2 text-3xl font-black text-[var(--sigo-text)]">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--sigo-muted)]">
                {description}
              </p>
            </header>

            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
