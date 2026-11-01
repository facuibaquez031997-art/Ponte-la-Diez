import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/common/AuthLayout'
import FormField from '../../components/common/FormField'
import { useAuth } from '../../hooks/useAuth'
import { getAuthErrorMessage } from './authError'

const LoginPage = () => {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={from} replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      heading="¡Bienvenido de vuelta, Diez!"
      subheading="Ingresá tus credenciales para administrar tus turnos y equipos."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          label="Contraseña"
          icon="lock"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? 'Ingresando...' : 'Ingresar a la cancha'}
          <span aria-hidden="true" className="material-symbols-outlined text-xl">
            arrow_forward
          </span>
        </button>
      </form>
    </AuthLayout>
  )
}

export default LoginPage
