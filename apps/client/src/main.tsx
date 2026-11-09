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
import OwnerCanchasPage from './pages/Owner/OwnerCanchasPage'
import OwnerHorariosPage from './pages/Owner/OwnerHorariosPage'
import HomePage from './pages/Home/HomePage'
import ProfilePage from './pages/Perfil/ProfilePage'
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
        ],
      },
      {
        element: <ProtectedRoute roles={['OWNER']} />,
        children: [
          { path: 'dueno', element: <OwnerCanchasPage /> },
          { path: 'dueno/canchas/:id/horarios', element: <OwnerHorariosPage /> },
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
