import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/Sidebar/NavBar";

const highlights = [
  {
    title: "Ordens completas",
    text: "Serviços, peças, valores, prazos e responsáveis reunidos no mesmo atendimento.",
  },
  {
    title: "Histórico organizado",
    text: "Clientes e veículos com registros claros para consultas rápidas da oficina.",
  },
  {
    title: "Gestão mais simples",
    text: "Equipe, estoque e relatórios organizados para reduzir retrabalho.",
  },
];

const modules = [
  "Clientes e veículos",
  "Ordens de serviço",
  "Peças e estoque",
  "Equipe da oficina",
  "Relatórios",
  "Área do cliente",
];

const benefits = [
  "Clientes, veículos e oficinas em um só lugar",
  "Pedidos com serviços, peças e status acompanháveis",
  "Relatórios para decisões mais rápidas",
  "Acesso web para oficina, funcionário e cliente",
];

const audiences = [
  {
    role: "Oficinas",
    text: "centralizam atendimentos, estoque e equipe em uma rotina mais organizada.",
  },
  {
    role: "Funcionários",
    text: "consultam pedidos, veículos, peças e serviços sem depender de registros soltos.",
  },
  {
    role: "Clientes",
    text: "acompanham o histórico do veículo com mais clareza sobre serviços e custos.",
  },
];

const steps = [
  "Cadastre clientes, veículos e equipe",
  "Abra pedidos com serviços e peças",
  "Acompanhe status, custos e histórico",
];

export const metadata: Metadata = {
  title: "SIGO | Sistema de Gestão para Oficinas",
  description:
    "SIGO é um sistema web para informatização e gerenciamento de oficinas, com ordens de serviço, veículos, clientes, peças, funcionários, relatórios e área do cliente.",
  keywords: [
    "SIGO",
    "sistema para oficina",
    "gestão de oficinas",
    "ordem de serviço oficina",
    "controle de peças",
    "histórico de manutenção",
    "sistema web para oficina mecânica",
  ],
  alternates: {
    canonical: "/landing-page",
  },
};

export default function LandingPage() {
  return (
    <div className="sigo-page">
      <a className="sigo-skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <NavBar />

      <main className="sigo-shell grid gap-8 py-8 lg:gap-10 lg:py-10">
        <section
          id="conteudo"
          className="grid items-center gap-7 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:py-8"
          aria-labelledby="hero-title"
        >
          <div className="max-w-3xl">
            <h1
              id="hero-title"
              className="mt-4 max-w-4xl text-5xl font-black leading-[1.05] text-[var(--sigo-blue-deep)] sm:text-6xl lg:text-7xl"
            >
              Gestão de oficinas simples e centralizada.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[var(--sigo-muted)] sm:text-lg">
              Controle clientes, veículos, pedidos, peças e relatórios
              em uma plataforma web objetiva para a rotina da oficina.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link className="sigo-button sigo-button-primary sm:min-w-36" href="/cadastro">
                Criar acesso
              </Link>
              <Link className="sigo-button sm:min-w-40" href="/login">
                Entrar no sistema
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5" aria-labelledby="destaques-title">
          <div className="max-w-2xl">
            <h2
              id="destaques-title"
              className="mt-3 text-3xl font-black leading-tight text-[var(--sigo-blue-deep)] sm:text-4xl"
            >
              O essencial para acompanhar a oficina.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map((highlight) => (
              <article className="sigo-card bg-white/80 p-5" key={highlight.title}>
                <h3 className="text-lg font-black text-[var(--sigo-blue-deep)]">
                  {highlight.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--sigo-muted)]">
                  {highlight.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="sigo-card overflow-hidden bg-white/85" aria-labelledby="modulos-title">
          <div className="border-b border-[var(--sigo-border)] p-5 sm:p-6">
            <p className="text-sm font-black uppercase text-[var(--sigo-blue)]">
              Módulos principais
            </p>
            <h2
              id="modulos-title"
              className="mt-2 text-2xl font-black leading-tight text-[var(--sigo-blue-deep)] sm:text-3xl"
            >
              Uma base integrada para a rotina da oficina.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--sigo-muted)]">
              O SIGO organiza os dados que antes ficavam em planilhas, papéis ou
              controles separados, mantendo o atendimento mais fácil de acompanhar.
            </p>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            {modules.map((module) => (
              <div className="sigo-card-soft p-4" key={module}>
                <span className="text-sm font-black text-[var(--sigo-blue-deep)]">
                  {module}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]" aria-label="Públicos e funcionamento">
          <div className="sigo-card bg-white/85 p-5 sm:p-6">
            <p className="text-sm font-black uppercase text-[var(--sigo-blue)]">
              Acesso por perfil
            </p>
            <div className="mt-5 grid gap-4">
              {audiences.map((audience) => (
                <article key={audience.role}>
                  <h3 className="text-lg font-black text-[var(--sigo-blue-deep)]">
                    {audience.role}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--sigo-muted)]">
                    {audience.text}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="sigo-card bg-white/85 p-5 sm:p-6">
            <p className="text-sm font-black uppercase text-[var(--sigo-blue)]">
              Como funciona
            </p>
            <ol className="mt-5 grid gap-3">
              {steps.map((step, index) => (
                <li className="flex gap-3" key={step}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sigo-surface-blue)] text-sm font-black text-[var(--sigo-blue)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong className="pt-1 text-sm leading-6 text-[var(--sigo-blue-deep)]">
                    {step}
                  </strong>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="pb-10">
          <div className="sigo-card grid gap-4 bg-white/85 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-black leading-tight text-[var(--sigo-blue-deep)]">
                Pronto para informatizar sua oficina?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sigo-muted)]">
                Crie um acesso para cadastrar clientes e oficinas ou entre para
                gerenciar pedidos, peças, serviços e relatórios.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="sigo-button sigo-button-primary" href="/cadastro">
                Começar cadastro
              </Link>
              <Link className="sigo-button" href="/login">
                Acessar login
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
