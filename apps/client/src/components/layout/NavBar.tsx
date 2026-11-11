import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import ConfirmDialog from '../common/ConfirmDialog'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../../types/auth'
import NotificationBell from './NotificationBell'

const NAV_LINKS = [
  { label: 'Explorar canchas', to: '/canchas' },
  { label: 'Falta uno', to: '/convocatorias' },
  { label: 'Contactos', to: '/contactos' },
  { label: 'Mis reservas', to: '#' },
  { label: 'Mensajes', to: '#' },
]

// An owner only manages courts, slots and (later) payments: none of the player links apply.
const OWNER_LINKS = [{ label: 'Mis canchas', to: '/dueno' }]

const ROLE_LABELS: Record<Role, string> = {
  PLAYER: 'Jugador',
  OWNER: 'Dueño',
}

const NavBar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  const handleLogout = () => {
    setConfirmingLogout(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-50 bg-primary-container shadow-[0_4px_20px_rgba(8,29,47,0.35)]">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:px-8 lg:px-12">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 focus:outline-none">
            <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" />
            <span className="font-display text-headline-md uppercase tracking-wider text-on-primary">
              Ponte la
            </span>
            <span className="font-display text-headline-md uppercase tracking-wider text-secondary-container">
              Diez
            </span>
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-6 lg:flex">
            {(user?.rol === 'OWNER' ? OWNER_LINKS : NAV_LINKS).map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className="font-semibold text-on-primary-container transition-colors hover:text-on-primary"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell />
              <Link
                to="/perfil"
                aria-label="Mi perfil"
                className="flex items-center gap-2 rounded-full bg-surface-tint/25 py-1 pl-2 pr-4 transition-all hover:bg-surface-tint/40"
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-black">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[18px] text-on-primary"
                    >
                      person
                    </span>
                  )}
                </div>
                <div className="hidden flex-col text-left sm:flex">
                  <span className="text-xs font-semibold leading-tight text-on-primary">
                    {user.nombre}
                  </span>
                  <span className="text-[10px] font-semibold uppercase leading-none tracking-wider text-secondary-container">
                    {ROLE_LABELS[user.rol]}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setConfirmingLogout(true)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-on-primary-container transition-all hover:bg-surface-tint/20 hover:text-on-primary active:scale-[0.98]"
              >
                Salir
              </button>
              <ConfirmDialog
                open={confirmingLogout}
                title="Cerrar sesión"
                message="¿Estás seguro de salir?"
                confirmLabel="Sí, salir"
                onConfirm={handleLogout}
                onCancel={() => setConfirmingLogout(false)}
              />
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-semibold text-on-primary-container transition-all hover:bg-surface-tint/20 hover:text-on-primary active:scale-[0.98]"
              >
                Ingresar
              </Link>
              <Link
                to="/registro"
                className="rounded-full bg-secondary-container px-5 py-2 text-sm font-bold text-on-secondary-fixed transition-all hover:bg-secondary-fixed-dim active:scale-[0.98]"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default NavBar
