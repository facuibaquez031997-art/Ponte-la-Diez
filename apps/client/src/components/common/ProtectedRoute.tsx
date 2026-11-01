import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../../types/auth'

interface ProtectedRouteProps {
  roles?: Role[]
}

const ProtectedRoute = ({ roles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="p-6 text-gray-500">Cargando...</p>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />

  return <Outlet />
}

export default ProtectedRoute
