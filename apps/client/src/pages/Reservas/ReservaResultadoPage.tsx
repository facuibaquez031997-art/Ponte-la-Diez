import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ReservaCard from '../../components/stitch/ReservaCard'
import { useMisReservas } from '../../hooks/useMisReservas'
import { usePayReserva } from '../../hooks/usePayReserva'

const containerClass = 'mx-auto w-full max-w-[640px] px-4 md:px-8'
// The webhook can arrive a few seconds after the player comes back from Mercado Pago.
const POLL_MS = 3000
const MAX_CHECKS = 20

const linkClass =
  'inline-flex h-11 items-center justify-center rounded-xl bg-primary-container px-6 text-sm font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.98]'

/**
 * Where Mercado Pago sends the player back. The address only tells which booking to look at
 * (`external_reference`): what is shown always comes from our server, never from the address.
 */
const ReservaResultadoPage = () => {
  const [params] = useSearchParams()
  const reservaId = params.get('external_reference')
  const mpStatus = params.get('status') ?? params.get('collection_status')
  const { reservas, loading, error, reload } = useMisReservas()
  const { payingId, payError, pay } = usePayReserva()
  const [gaveUp, setGaveUp] = useState(false)
  const checks = useRef(0)

  const reserva = reservas.find((item) => item.id === reservaId) ?? null
  const waiting = reserva?.estado === 'PENDING'

  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(() => {
      checks.current += 1
      if (checks.current >= MAX_CHECKS) {
        window.clearInterval(timer)
        setGaveUp(true)
        return
      }
      void reload()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waiting, reload])

  const failed = mpStatus === 'rejected' || mpStatus === 'failure'

  let title = 'Verificando tu pago...'
  let message: string | null = null
  if (!loading && !error) {
    if (!reservaId || !reserva) {
      title = 'No encontramos la reserva'
      message =
        'Si no llegaste a pagar a tiempo, el turno volvió a quedar libre. Podés elegir otro desde Explorar canchas.'
    } else if (reserva.estado === 'CONFIRMED') {
      title = '¡Reserva confirmada!'
      message = 'Recibimos tu pago. Acá tenés los datos de tu turno.'
    } else if (failed || gaveUp) {
      title = 'Todavía no pudimos confirmar tu pago'
      message = failed
        ? 'Mercado Pago no aprobó el pago. Podés intentarlo de nuevo con otro medio mientras el turno siga reservado.'
        : 'Si ya pagaste, puede demorar unos minutos: revisá Mis reservas. Si no, podés intentarlo de nuevo.'
    } else {
      title = 'Estamos confirmando tu pago...'
      message = 'Esto tarda unos segundos. No cierres esta pantalla.'
    }
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <section className={`${containerClass} py-10`}>
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          {title}
        </h1>
        {message && <p className="mt-2 mb-6 text-sm text-on-surface-variant">{message}</p>}

        {(error || payError) && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {error ?? payError}
          </p>
        )}

        {reserva && <ReservaCard reserva={reserva} onPay={pay} paying={payingId === reserva.id} />}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/reservas" className={linkClass}>
            Ver mis reservas
          </Link>
          {!reserva && !loading && (
            <Link to="/canchas" className={linkClass}>
              Explorar canchas
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}

export default ReservaResultadoPage
