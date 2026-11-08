import { Navigate, Outlet, useLocation } from 'react-router-dom'
import NavBar from './components/layout/NavBar'
import { useAuth } from './hooks/useAuth'

const ROUTES_WITHOUT_NAVBAR = ['/login', '/registro']
const PROFILE_ROUTE = '/perfil'
// A player without photo can only reach these until they upload one.
const ROUTES_WITHOUT_PHOTO_GATE = [PROFILE_ROUTE, ...ROUTES_WITHOUT_NAVBAR]

function App() {
  const { pathname } = useLocation()
  const { user, loading } = useAuth()
  const showNavBar = !ROUTES_WITHOUT_NAVBAR.includes(pathname)
  const needsPhoto = !loading && user?.rol === 'PLAYER' && !user.avatarUrl

  if (needsPhoto && !ROUTES_WITHOUT_PHOTO_GATE.includes(pathname)) {
    return <Navigate to={PROFILE_ROUTE} replace />
  }

  return (
    <>
      {showNavBar && <NavBar />}
      <Outlet />
    </>
  )
}

export default App
