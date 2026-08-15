import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const resources = [
  { title: "Clientes e veículos", text: "Históricos, dados e atendimentos conectados para uma consulta rápida e segura.", icon: "01" },
  { title: "Ordens de serviço", text: "Serviços, peças, responsáveis, prazos e status reunidos do início à entrega.", icon: "02" },
  { title: "Estoque inteligente", text: "Visibilidade sobre peças e quantidades para comprar melhor e evitar imprevistos.", icon: "03" },
  { title: "Gestão da equipe", text: "Acessos por perfil deixam cada pessoa focada somente no que precisa executar.", icon: "04" },
  { title: "Indicadores claros", text: "Informações operacionais e financeiras para decisões mais rápidas e consistentes.", icon: "05" },
  { title: "Área do cliente", text: "Mais transparência no acompanhamento dos veículos, serviços e custos realizados.", icon: "06" },
];

const workflow = [
  "Cadastre clientes, veículos, serviços e equipe.",
  "Abra a ordem e vincule peças, prazos e responsáveis.",
  "Acompanhe a execução e mantenha o cliente informado.",
  "Consulte o histórico e os resultados da operação.",
];

const audiences = [
  { role: "Oficina", title: "Visão completa da operação", text: "Centralize equipe, estoque, atendimentos e indicadores em um ambiente confiável." },
  { role: "Funcionário", title: "Rotina simples e objetiva", text: "Acesse clientes, veículos, serviços, estoque e ordens com as permissões certas." },
  { role: "Cliente", title: "Transparência no atendimento", text: "Consulte veículos e histórico de serviços com mais clareza e praticidade." },
];

export const metadata: Metadata = {
  title: "SIGO | Gestão moderna para oficinas",
  description: "Organize clientes, veículos, ordens de serviço, estoque, equipe e resultados com o SIGO.",
  alternates: { canonical: "/" },
};

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="2.5">
      <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-900">
      <a className="sigo-skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 w-[min(1180px,calc(100%-2rem))] items-center justify-between gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="SIGO — página inicial">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-950 sm:h-14 sm:w-14">
              <Image src="/sigo-logo.png" alt="" width={66} height={66} className="h-11 w-11 object-contain sm:h-12 sm:w-12" priority />
            </span>
            <span className="hidden border-l border-slate-200 pl-3 sm:block">
              <strong className="block text-sm font-black tracking-[0.12em] text-blue-950">SIGO</strong>
              <span className="text-xs font-bold leading-5 text-slate-600">Gestão para oficinas</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex" aria-label="Navegação principal">
            <a href="#recursos" className="hover:text-blue-700">Recursos</a>
            <a href="#como-funciona" className="hover:text-blue-700">Como funciona</a>
            <a href="#perfis" className="hover:text-blue-700">Para quem é</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-extrabold text-slate-700 hover:bg-slate-100 sm:px-5">Entrar</Link>
            <Link href="/cadastro" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 sm:px-5">Começar agora</Link>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <section className="relative isolate min-h-[690px] overflow-hidden bg-slate-950">
          <Image src="/oficina-profissional.jpeg" alt="Profissional realizando manutenção em um veículo dentro de uma oficina" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,16,38,0.98)_0%,rgba(3,35,76,0.92)_45%,rgba(3,35,76,0.50)_72%,rgba(2,16,38,0.26)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(22,166,217,0.22),transparent_33%)]" />
          <div className="relative mx-auto flex min-h-[690px] w-[min(1180px,calc(100%-2rem))] items-center py-20">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100"><span className="h-2 w-2 rounded-full bg-cyan-300" />Sua oficina no controle</span>
              <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">Mais eficiência na oficina. Mais clareza no negócio.</h1>
              <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-blue-100 sm:text-xl">O SIGO reúne clientes, veículos, ordens, estoque, equipe e indicadores em uma plataforma feita para simplificar a operação.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/cadastro" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-cyan-400 px-7 text-base font-black text-slate-950 shadow-xl shadow-cyan-950/25 hover:-translate-y-0.5 hover:bg-cyan-300">Criar acesso <ArrowIcon /></Link>
                <Link href="/login" className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-7 text-base font-black text-white backdrop-blur-sm hover:bg-white/20">Acessar o sistema</Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-bold text-blue-100">
                {["100% online", "Acesso por perfil", "Dados centralizados"].map((item) => <span key={item} className="flex items-center gap-2"><CheckIcon />{item}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-10 grid w-[min(1180px,calc(100%-2rem))] gap-4 md:grid-cols-3" aria-label="Benefícios principais">
          {[
            ["Operação", "Menos tarefas soltas", "Fluxos organizados do cadastro à entrega do veículo."],
            ["Gestão", "Decisões mais seguras", "Informações reunidas para acompanhar prioridades e resultados."],
            ["Experiência", "Atendimento mais claro", "Histórico acessível para equipe, oficina e cliente."],
          ].map(([eyebrow, title, text]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_22px_60px_rgba(15,45,85,0.12)]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{eyebrow}</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">{title}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </section>

        <section id="recursos" className="mx-auto w-[min(1180px,calc(100%-2rem))] py-24 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Tudo conectado</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl">Uma plataforma para toda a jornada da oficina</h2>
            <p className="mt-5 text-base font-medium leading-7 text-slate-600 sm:text-lg">Substitua controles espalhados por uma visão única, intuitiva e pronta para a rotina.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <article key={resource.title} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/10">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700 group-hover:bg-blue-700 group-hover:text-white">{resource.icon}</span>
                <h3 className="mt-5 text-xl font-black text-slate-950">{resource.title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{resource.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="bg-slate-950 py-24 text-white sm:py-28">
          <div className="mx-auto grid w-[min(1180px,calc(100%-2rem))] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[430px] overflow-hidden rounded-3xl">
              <Image src="/gestao-profissional.jpeg" alt="Equipe administrativa analisando a gestão do negócio" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-slate-950/70 p-5 backdrop-blur-md">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">Gestão que acompanha o ritmo</p>
                <p className="mt-2 text-lg font-bold leading-7 text-white">Informação útil para o balcão, a oficina e a administração.</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-300">Como funciona</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-white sm:text-5xl">Da entrada do veículo à decisão de gestão</h2>
              <p className="mt-5 text-base font-medium leading-7 text-slate-300">Um fluxo simples mantém cada atendimento rastreável e transforma a rotina em informação para o negócio.</p>
              <ol className="mt-9 grid gap-5">
                {workflow.map((step, index) => <li key={step} className="flex items-start gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 text-sm font-black text-cyan-200">{index + 1}</span><span className="pt-1 text-base font-bold leading-7 text-slate-100">{step}</span></li>)}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-[min(1180px,calc(100%-2rem))] items-center gap-12 py-24 sm:py-28 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Controle financeiro</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl">Organização que protege a margem da oficina</h2>
            <p className="mt-5 text-base font-medium leading-8 text-slate-600">Enxergue custos, peças, serviços e movimentações com mais precisão. Quando a operação está organizada, o crescimento deixa de depender de improviso.</p>
            <ul className="mt-8 grid gap-4">
              {["Custos de peças e serviços reunidos na ordem", "Estoque alinhado ao trabalho executado", "Histórico para apoiar análises e planejamento"].map((item) => <li key={item} className="flex items-center gap-3 text-sm font-extrabold text-slate-800"><CheckIcon />{item}</li>)}
            </ul>
          </div>
          <div className="relative min-h-[420px] overflow-hidden rounded-3xl shadow-2xl shadow-blue-950/20">
            <Image src="/economia-profissional.jpeg" alt="Profissionais analisando indicadores financeiros e econômicos" fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/65 via-transparent to-transparent" />
          </div>
        </section>

        <section id="perfis" className="bg-slate-50 py-24 sm:py-28">
          <div className="mx-auto w-[min(1180px,calc(100%-2rem))]">
            <div className="max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Acesso por perfil</p><h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl">A experiência certa para cada pessoa</h2></div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {audiences.map((audience) => <article key={audience.role} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">{audience.role}</span><h3 className="mt-5 text-xl font-black text-slate-950">{audience.title}</h3><p className="mt-3 text-sm font-medium leading-6 text-slate-600">{audience.text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:py-24">
          <div className="relative mx-auto w-full max-w-[1180px] overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#082f63,#075fbd)] px-6 py-14 text-center shadow-2xl shadow-blue-950/20 sm:px-12 sm:py-16">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/15 blur-2xl" />
            <div className="relative mx-auto max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Pronto para evoluir?</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-white sm:text-5xl">Leve mais controle para a sua oficina</h2>
              <p className="mt-5 text-base font-medium leading-7 text-blue-100 sm:text-lg">Comece agora e concentre sua operação em um sistema simples, seguro e feito para o dia a dia.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/cadastro" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-cyan-300 px-7 text-base font-black text-slate-950 hover:bg-cyan-200">Criar acesso <ArrowIcon /></Link>
                <Link href="/login" className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-7 text-base font-black text-white hover:bg-white/20">Já tenho uma conta</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
