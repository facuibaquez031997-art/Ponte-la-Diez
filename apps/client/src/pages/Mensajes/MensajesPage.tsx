import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ChatThread from '../../components/stitch/ChatThread'
import ConversacionItem from '../../components/stitch/ConversacionItem'
import { useAuth } from '../../hooks/useAuth'
import { useConversaciones } from '../../hooks/useConversaciones'

const containerClass = 'mx-auto w-full max-w-[1280px] px-4 md:px-8 lg:px-12'

const MensajesPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { conversaciones, loading, error, reload } = useConversaciones()

  const goToList = useCallback(() => navigate('/mensajes'), [navigate])

  if (!user) return null
  const unread = conversaciones.reduce((total, c) => total + c.noLeidos, 0)

  return (
    <main className="min-h-screen w-full bg-background">
      <section className={`${containerClass} py-8`}>
        <div className="mb-4">
          <div className="font-display text-eyebrow-badge uppercase text-secondary">
            Centro de mensajes
          </div>
          <h1 className="mt-1 font-display text-headline-lg uppercase tracking-tight text-on-surface">
            Mensajes
          </h1>
        </div>

        <div className="grid min-h-[740px] w-full grid-cols-1 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl lg:grid-cols-12">
          <aside
            className={`flex-col bg-surface-container-low lg:col-span-4 ${id ? 'hidden lg:flex' : 'flex'}`}
          >
            <div className="flex items-center justify-between bg-surface-container-lowest p-4">
              <h2 className="font-display text-headline-sm uppercase tracking-wide text-primary-container">
                Conversaciones
              </h2>
              {unread > 0 && (
                <span className="rounded-full bg-secondary-container px-2 py-0.5 font-display text-eyebrow-badge text-on-secondary-container">
                  {unread} {unread === 1 ? 'nuevo' : 'nuevos'}
                </span>
              )}
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-1">
              {error && (
                <p
                  role="alert"
                  className="m-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
                >
                  {error}
                </p>
              )}
              {loading && (
                <p className="p-4 text-sm text-on-surface-variant">Cargando tus mensajes...</p>
              )}
              {!loading && !error && conversaciones.length === 0 && (
                <p className="p-4 text-sm text-on-surface-variant">
                  {user.rol === 'PLAYER'
                    ? 'Todavía no escribiste a ningún dueño. Podés consultar desde una cancha o desde tus reservas.'
                    : 'Todavía no recibiste mensajes de jugadores.'}
                </p>
              )}
              {conversaciones.map((conversacion) => (
                <ConversacionItem
                  key={conversacion.id}
                  conversacion={conversacion}
                  rol={user.rol}
                  active={conversacion.id === id}
                  onSelect={(selected) => navigate(`/mensajes/${selected}`)}
                />
              ))}
            </div>
          </aside>

          <div className={`lg:col-span-8 ${id ? 'flex' : 'hidden lg:flex'}`}>
            {id ? (
              <ChatThread key={id} id={id} rol={user.rol} onChanged={reload} onBack={goToList} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-surface-bright p-8 text-center text-on-surface-variant">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[48px] text-secondary"
                >
                  forum
                </span>
                <p className="text-sm">Elegí una conversación para leerla.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default MensajesPage
