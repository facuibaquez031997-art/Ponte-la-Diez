import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthProvider'
import LoginPage from './pages/Auth/LoginPage'
import ExplorarCanchasPage from './pages/Canchas/ExplorarCanchasPage'
import RegisterPage from './pages/Auth/RegisterPage'
import HomePage from './pages/Home/HomePage'
import './styles/index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'canchas', element: <ExplorarCanchasPage /> },
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
