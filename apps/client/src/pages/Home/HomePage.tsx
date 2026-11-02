import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const HomePage = () => {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-6 text-gray-500">Cargando...</p>

  return <Navigate to={user ? '/canchas' : '/login'} replace />
}

export default HomePage
