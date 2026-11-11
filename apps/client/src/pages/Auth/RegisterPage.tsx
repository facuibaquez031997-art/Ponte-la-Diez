import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/common/AuthLayout'
import BarrioCombobox from '../../components/common/BarrioCombobox'
import FormField from '../../components/common/FormField'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../../types/auth'
import { getAuthErrorMessage } from './authError'

const ROLES: { value: Role; label: string; hint: string; icon: string }[] = [
  { value: 'PLAYER', label: 'Jugador', hint: 'Quiero jugar', icon: 'directions_run' },
  { value: 'OWNER', label: 'Dueño', hint: 'Tengo canchas', icon: 'stadium' },
]

const RegisterPage = () => {
  const { user, register } = useAuth()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [barrioPontevedra, setBarrioPontevedra] = useState('')
  const [rol, setRol] = useState<Role>('PLAYER')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register({
        nombre,
        email,
        password,
        rol,
        telefono: telefono || undefined,
        barrioPontevedra: barrioPontevedra || undefined,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      heading="Sumate a Ponte la Diez"
      subheading="Completá tus datos para empezar a jugar o publicar tus canchas."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
            ¿Cuál es tu rol?
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(({ value, label, hint, icon }) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="rol"
                  value={value}
                  checked={rol === value}
                  onChange={() => setRol(value)}
                  className="peer sr-only"
                />
                <div className="flex flex-col items-center rounded-xl bg-surface-container-low p-3.5 text-center shadow-sm transition-all peer-checked:bg-primary-container peer-checked:text-on-primary peer-focus-visible:ring-2 peer-focus-visible:ring-secondary-container">
                  <span aria-hidden="true" className="material-symbols-outlined mb-1">
                    {icon}
                  </span>
                  <span className="text-base font-bold">{label}</span>
                  <span className="mt-0.5 text-xs opacity-80">{hint}</span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <FormField
          id="nombre"
          label="Nombre completo"
          icon="person"
          placeholder="Ej. Mateo Rossi"
          required
          minLength={2}
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <FormField
          id="email"
          label="Correo electrónico"
          icon="alternate_email"
          type="email"
          autoComplete="email"
          placeholder="nombre@ejemplo.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          id="password"
          label="Contraseña (mínimo 8 caracteres)"
          icon="lock"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormField
          id="telefono"
          label="Teléfono (opcional)"
          icon="call"
          type="tel"
          maxLength={30}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <BarrioCombobox
          id="barrio"
          label="Barrio de Pontevedra (opcional)"
          value={barrioPontevedra}
          onChange={setBarrioPontevedra}
        />

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-secondary-container px-6 py-3.5 font-display text-headline-sm uppercase tracking-wider text-on-secondary-fixed shadow-md transition-all hover:bg-secondary-fixed-dim active:scale-[0.98] disabled:opacity-60"
        >
          {submitting
            ? 'Creando cuenta...'
            : rol === 'OWNER'
              ? 'Crear cuenta de dueño'
              : 'Crear cuenta de jugador'}
          <span aria-hidden="true" className="material-symbols-outlined text-xl">
            arrow_forward
          </span>
        </button>
      </form>
    </AuthLayout>
  )
}

export default RegisterPage
