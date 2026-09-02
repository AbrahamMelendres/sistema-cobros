import Image from "next/image";

type IconName = "responsabilidad" | "companerismo" | "respeto" | "compromiso";
type ValueCardProps = { icon: IconName; title: string };
type TeamMemberCardProps = { name: string; role: string; photo: string; positionIcon: "gear" | "code" };

const values: ValueCardProps[] = [
  { icon: "responsabilidad", title: "Responsabilidad Social" },
  { icon: "companerismo", title: "Compañerismo" },
  { icon: "respeto", title: "Respeto" },
  { icon: "compromiso", title: "Compromiso" },
];

function ValueIcon({ name }: { name: IconName }) {
  const paths = {
    responsabilidad: <><path d="M12 3 4.5 6v5.5c0 4.7 3.2 7.9 7.5 9.5 4.3-1.6 7.5-4.8 7.5-9.5V6L12 3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
    companerismo: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3" /><path d="M16 7a3 3 0 0 1 0 5.8M20 20v-1.4a3.5 3.5 0 0 0-2.5-3.3" /></>,
    respeto: <><path d="M12 21s8-4.2 8-10.2A4.2 4.2 0 0 0 12 8a4.2 4.2 0 0 0-8 2.8C4 16.8 12 21 12 21Z" /><path d="M8.5 12.5h7M12 9v7" /></>,
    compromiso: <path d="m12 3 2.5 5.1 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function PositionIcon({ name }: { name: "gear" | "code" }) {
  return name === "gear" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.5v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6v-2.5h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L9 6.7l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1h2.5v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
  ) : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" /></svg>;
}

function MetricIcon({ name }: { name: "calendar" | "check" | "spark" }) {
  const path = name === "calendar" ? "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 2v4M16 2v4M4 9h16" : name === "check" ? "m5 12 4 4L19 6" : "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8";
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

function ValueCard({ icon, title }: ValueCardProps) {
  const number = String(values.findIndex((value) => value.title === title) + 1).padStart(2, "0");
  return <article className="group relative min-h-44 overflow-hidden border border-[var(--color-line)] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-navy-700)] hover:shadow-lg">
    <span className="pointer-events-none absolute -right-1 -top-5 font-display text-7xl font-bold text-[var(--color-navy-50)] transition-colors duration-300 group-hover:text-[var(--color-navy-100)]">{number}</span>
    <div className="relative mb-7 flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-navy-700)_10%,transparent)] text-[var(--color-navy-800)] transition-all duration-300 group-hover:bg-[var(--color-navy-800)] group-hover:text-white"><div className="h-8 w-8"><ValueIcon name={icon} /></div></div>
    <h3 className="relative font-display text-base font-semibold text-[var(--color-ink)]">{title}</h3>
  </article>;
}

function TeamMemberCard({ name, role, photo, positionIcon }: TeamMemberCardProps) {
  return <article className="group flex items-center gap-5 border border-[var(--color-line)] bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6">
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--color-navy-950)] shadow-md ring-4 ring-[var(--color-navy-50)] transition-transform duration-300 group-hover:scale-105"><Image src={photo} alt={`Foto de ${name}`} width={160} height={160} className="h-full w-full object-cover" /></div>
    <div><h3 className="font-display text-lg font-semibold leading-tight text-[var(--color-ink)]">{name}</h3><p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-navy-700)]"><span className="h-4 w-4"><PositionIcon name={positionIcon} /></span>{role}</p></div>
  </article>;
}

export default function SobreNosotros() {
  return <div className="pb-8">
    <header className="relative mb-12 overflow-hidden bg-gradient-to-br from-[var(--color-navy-950)] to-[var(--color-navy-800)] px-6 py-12 text-center text-white sm:px-10 sm:py-16 sm:text-left">
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_20px_20px,transparent_0_5px,white_6px_7px,transparent_8px),linear-gradient(135deg,transparent_48%,white_49%_50%,transparent_51%)] [background-size:80px_80px]" />
      <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:gap-8"><div className="rounded-full bg-white/10 p-2 shadow-[0_0_32px_rgba(147,197,253,0.3)] ring-1 ring-white/20"><Image src="/logo.jpeg" alt="Academia Técnica de Ingeniería y Tecnologías Informáticas" width={136} height={136} className="h-28 w-28 rounded-full border border-white/20 object-cover sm:h-32 sm:w-32" priority /></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Academia Técnica de Ingeniería y Tecnologías Informáticas (CCA)</p><h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Sobre Nosotros</h1></div></div>
    </header>

    <section className="mb-14 grid gap-8 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16"><div><p className="mb-3 border-l-4 border-[var(--color-navy-700)] pl-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-navy-700)]">Nuestra historia</p><h2 className="font-display text-3xl font-bold text-[var(--color-ink)] sm:text-4xl">Aprender haciendo.</h2></div><p className="max-w-2xl border-l-2 border-[var(--color-navy-700)] pl-6 text-lg leading-8 text-[var(--color-ink-soft)]">Este proyecto nació de la necesidad de aprender y poner en práctica los conocimientos adquiridos, transformando el aprendizaje académico en soluciones reales para la comunidad.</p></section>

    <section className="mb-14 grid gap-5 py-8 md:grid-cols-2"><article className="border-t-4 border-[var(--color-navy-800)] bg-white p-7 shadow-sm transition-all duration-300 hover:shadow-lg sm:p-9"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-navy-700)]">01 / Misión</p><p className="text-lg leading-8 text-[var(--color-ink-soft)]">Brindar servicios de mantenimiento a computadoras y laptops, dirigidos a toda la población que posea un equipo y necesite soporte técnico confiable y accesible.</p></article><article className="border-t-4 border-[var(--color-navy-700)] bg-[var(--color-navy-900)] p-7 text-white shadow-sm transition-all duration-300 hover:shadow-lg sm:p-9"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">02 / Visión</p><p className="text-lg leading-8 text-blue-50">Ser un servicio de referencia en mantenimiento, optimización, reinstalación y actualización de equipos, garantizando que cada PC o laptop funcione siempre a su máximo rendimiento.</p></article></section>

    <section className="mb-14 py-8"><div className="mb-6 flex items-end justify-between gap-4"><div><p className="mb-2 border-l-4 border-[var(--color-navy-700)] pl-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-navy-700)]">Lo que nos guía</p><h2 className="font-display text-3xl font-bold text-[var(--color-ink)]">Nuestros valores</h2></div><span className="hidden text-sm text-[var(--color-ink-soft)] sm:block">04 principios</span></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map((value) => <ValueCard key={value.title} {...value} />)}</div></section>

    <section className="mb-14 grid gap-10 py-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16"><div><p className="mb-2 border-l-4 border-[var(--color-navy-700)] pl-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-navy-700)]">Las personas detrás</p><h2 className="font-display text-3xl font-bold text-[var(--color-ink)]">Nuestro equipo</h2><p className="mt-4 max-w-md leading-7 text-[var(--color-ink-soft)]">Conocimiento técnico, colaboración y compromiso para que cada equipo vuelva a rendir al máximo.</p></div><div className="grid gap-4"><TeamMemberCard name="Ing. Daniel Vino Villca" role="Fundador y Encargado" photo="/daniel-vino-villca.jpeg.jpeg" positionIcon="gear" /><TeamMemberCard name="Abraham Melendres Mico" role="Desarrollador del Sistema" photo="/abraham-melendres-mico.jpeg.jpeg" positionIcon="code" /></div></section>

    <section className="mb-8 bg-[var(--color-navy-950)] px-6 py-12 text-white sm:px-9 sm:py-14"><div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="mb-2 border-l-4 border-blue-300 pl-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Experiencia / Logros</p><h2 className="font-display text-3xl font-bold">Lo que construimos</h2></div><p className="text-sm text-blue-200">Siempre en evolución</p></div><div className="grid gap-8 border-t border-white/15 pt-7 sm:grid-cols-3"><div><div className="mb-3 h-7 w-7 text-blue-200"><MetricIcon name="calendar" /></div><p className="font-display text-5xl font-bold text-white">2+</p><p className="mt-2 text-sm text-blue-100">años de experiencia</p></div><div><div className="mb-3 h-7 w-7 text-blue-200"><MetricIcon name="check" /></div><p className="font-display text-5xl font-bold text-white">100%</p><p className="mt-2 text-sm text-blue-100">soluciones sin errores</p></div><div><div className="mb-3 h-7 w-7 text-blue-200"><MetricIcon name="spark" /></div><p className="font-display text-5xl font-bold text-white">+1</p><p className="mt-2 text-sm text-blue-100">en constante aprendizaje</p></div></div></section>

    {/* Testimonios: se activara cuando existan resenas de clientes. */}
  </div>;
}
