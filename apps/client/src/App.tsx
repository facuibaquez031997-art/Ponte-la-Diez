import { Outlet, useLocation } from 'react-router-dom'
import NavBar from './components/layout/NavBar'

const ROUTES_WITHOUT_NAVBAR = ['/login', '/registro']

function App() {
  const { pathname } = useLocation()
  const showNavBar = !ROUTES_WITHOUT_NAVBAR.includes(pathname)

  return (
    <>
      {showNavBar && <NavBar />}
      <Outlet />
    </>
  )
}

export default App
