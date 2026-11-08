import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import ProtectedRoute from './components/common/ProtectedRoute'
import { AuthProvider } from './context/AuthProvider'
import LoginPage from './pages/Auth/LoginPage'
import ConvocatoriasPage from './pages/Convocatorias/ConvocatoriasPage'
import ExplorarCanchasPage from './pages/Canchas/ExplorarCanchasPage'
import RegisterPage from './pages/Auth/RegisterPage'
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
