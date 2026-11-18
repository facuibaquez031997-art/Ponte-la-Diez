import { useSearchParams } from 'react-router-dom'
import { useMpCuenta } from '../../hooks/useMpCuenta'

/** What the server tells us through `?mp=` after the owner comes back from Mercado Pago. */
const RESULT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  linked: { text: 'Listo, vinculamos tu cuenta de Mercado Pago.', ok: true },
  denied: {
    text: 'No diste el permiso en Mercado Pago, así que la cuenta no se vinculó.',
    ok: false,
  },
  invalid: {
    text: 'El enlace de vinculación venció o no es válido. Probá de nuevo desde acá.',
    ok: false,
  },
  error: {
    text: 'No pudimos terminar la vinculación con Mercado Pago. Probá de nuevo en un momento.',
    ok: false,
  },
}

const OwnerMercadoPagoPage = () => {
  const [params] = useSearchParams()
  const { linked, loading, error, redirecting, link } = useMpCuenta()
  const result = RESULT_MESSAGES[params.get('mp') ?? '']

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6 md:px-8 lg:py-10">
      <section className="flex flex-col gap-1">
        <p className="text-label-sm uppercase tracking-wider text-secondary">Modo dueño</p>
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          Cuenta Mercado Pago
        </h1>
        <p className="text-sm text-on-surface-variant">
          Los pagos de tus canchas entran directo a tu cuenta de Mercado Pago. La plataforma se
          queda con su comisión de cada cobro y las devoluciones salen de tu cuenta.
        </p>
      </section>

      {result && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            result.ok
              ? 'bg-surface-container-low text-on-surface'
              : 'bg-error-container text-on-error-container'
          }`}
        >
          {result.text}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-on-surface-variant">Cargando tu cuenta...</p>}

      {!loading && !error && (
        <section className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-label-sm uppercase text-on-surface-variant">Estado</p>
          <p className="font-display text-headline-md text-on-surface">
            {linked ? 'Cuenta Mercado Pago vinculada' : 'Todavía no vinculaste tu cuenta'}
          </p>
          <p className="text-sm text-on-surface-variant">
            {linked
              ? 'Ya podés recibir pagos. Si cambiaste de cuenta en Mercado Pago, volvé a vincularla.'
              : 'Hasta que la vincules, los jugadores no pueden pagar las reservas de tus canchas.'}
          </p>
          <button
            type="button"
            onClick={link}
            disabled={redirecting}
            className="self-start rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {redirecting
              ? 'Redirigiendo a Mercado Pago...'
              : linked
                ? 'Volver a vincular'
                : 'Vincular Mercado Pago'}
          </button>
        </section>
      )}
    </main>
  )
}

export default OwnerMercadoPagoPage
