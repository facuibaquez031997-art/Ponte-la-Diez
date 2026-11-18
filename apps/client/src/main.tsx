import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import ProtectedRoute from './components/common/ProtectedRoute'
import { AuthProvider } from './context/AuthProvider'
import LoginPage from './pages/Auth/LoginPage'
import ContactosPage from './pages/Contactos/ContactosPage'
import ConvocatoriasPage from './pages/Convocatorias/ConvocatoriasPage'
import ExplorarCanchasPage from './pages/Canchas/ExplorarCanchasPage'
import RegisterPage from './pages/Auth/RegisterPage'
import OwnerAgendaPage from './pages/Owner/OwnerAgendaPage'
import OwnerCanchasPage from './pages/Owner/OwnerCanchasPage'
import OwnerHorariosPage from './pages/Owner/OwnerHorariosPage'
import OwnerMercadoPagoPage from './pages/Owner/OwnerMercadoPagoPage'
import OwnerReservasPage from './pages/Owner/OwnerReservasPage'
import HomePage from './pages/Home/HomePage'
import MensajesPage from './pages/Mensajes/MensajesPage'
import ProfilePage from './pages/Perfil/ProfilePage'
import MisReservasPage from './pages/Reservas/MisReservasPage'
import ReservaResultadoPage from './pages/Reservas/ReservaResultadoPage'
import './styles/index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'canchas', element: <ExplorarCanchasPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'perfil', element: <ProfilePage /> },
          { path: 'convocatorias', element: <ConvocatoriasPage /> },
          { path: 'contactos', element: <ContactosPage /> },
          { path: 'mensajes', element: <MensajesPage /> },
          { path: 'mensajes/:id', element: <MensajesPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={['PLAYER']} />,
        children: [
          { path: 'reservas', element: <MisReservasPage /> },
          { path: 'reservas/resultado', element: <ReservaResultadoPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={['OWNER']} />,
        children: [
          { path: 'dueno', element: <OwnerCanchasPage /> },
          { path: 'dueno/canchas/:id/horarios', element: <OwnerHorariosPage /> },
          { path: 'dueno/reservas', element: <OwnerReservasPage /> },
          { path: 'dueno/agenda', element: <OwnerAgendaPage /> },
          { path: 'dueno/mercadopago', element: <OwnerMercadoPagoPage /> },
        ],
      },
      { path: 'login', element: <LoginPage /> },
      { path: 'registro', element: <RegisterPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
)
