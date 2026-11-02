import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '../../assets/logo.png'

interface AuthLayoutProps {
  heading: string
  subheading: string
  children: ReactNode
}

const STATS = [
  { value: '+20', label: 'Canchas' },
  { value: '4.9', label: 'Valoración' },
  { value: '24/7', label: 'Reservas' },
]

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 rounded-xl py-3 text-center text-sm transition-all duration-200 ${
    isActive
      ? 'bg-surface-container-lowest font-semibold text-on-surface shadow-sm'
      : 'text-on-surface-variant hover:text-on-surface'
  }`

const AuthLayout = ({ heading, subheading, children }: AuthLayoutProps) => (
  <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-12 lg:px-8">
    <div className="grid grid-cols-1 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl lg:grid-cols-12">
      <section className="relative flex flex-col justify-between overflow-hidden bg-primary-container p-8 text-on-primary sm:p-12 lg:col-span-5">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-secondary-container opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-secondary opacity-30 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-14 w-14 rounded-2xl object-contain" />
            <div className="flex flex-col">
              <span className="font-display text-headline-md uppercase leading-tight tracking-wider">
                Ponte la Diez
              </span>
              <span className="-mt-1 font-display text-eyebrow-badge uppercase text-secondary-fixed">
                Canchas y Partidos
              </span>
            </div>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full bg-on-secondary-container/40 px-3.5 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-container" />
            <span className="font-display text-eyebrow-badge uppercase text-secondary-container">
              Tu próxima cancha está más cerca
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="font-display text-5xl uppercase leading-none tracking-tight sm:text-display-hero">
              El partido <br />
              <span className="text-secondary-container">empieza acá.</span>
            </h1>
            <p className="max-w-sm text-sm text-primary-fixed-dim">
              La plataforma definitiva para reservar canchas, organizar partidos y coordinar tu
              equipo en Pontevedra sin demoras ni llamadas.
            </p>
          </div>
        </div>

        <div className="relative z-10 pt-10 sm:pt-16">
          <div className="grid grid-cols-3 gap-3">
            {STATS.map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-2xl bg-on-primary-fixed-variant/40 p-3 text-center backdrop-blur-md"
              >
                <span className="font-display text-headline-md text-secondary-container">
                  {value}
                </span>
                <span className="mt-0.5 text-xs uppercase tracking-wider text-surface-dim">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-surface-dim">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-base text-secondary-container"
            >
              verified
            </span>
            <span>Confirmación al instante con Mercado Pago</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-between bg-surface-container-lowest p-6 sm:p-10 md:p-12 lg:col-span-7">
        <div>
          <nav
            aria-label="Acceso"
            className="mx-auto mb-8 flex max-w-md rounded-2xl bg-surface-container p-1"
          >
            <NavLink to="/login" className={tabClass}>
              Iniciar sesión
            </NavLink>
            <NavLink to="/registro" className={tabClass}>
              Crear cuenta
            </NavLink>
          </nav>

          <header className="mx-auto mb-6 max-w-md text-center">
            <h2 className="font-display text-headline-md uppercase tracking-wide text-on-surface">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">{subheading}</p>
          </header>

          <div className="mx-auto max-w-md">{children}</div>
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-md items-center justify-center gap-2 pt-8 text-xs text-on-surface-variant">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-lg text-secondary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            shield
          </span>
          <span>Tus datos y transacciones se encuentran encriptados y protegidos</span>
        </div>
      </section>
    </div>
  </main>
)

export default AuthLayout
