import { useRef, useState, type ChangeEvent } from 'react'
import { getAuthErrorMessage } from '../../pages/Auth/authError'
import { AvatarUploadError } from '../../services/avatar.service'
import { FOTO_ACCEPT, uploadCanchaFoto } from '../../services/canchaFotos.service'
import { canchasService } from '../../services/canchas.service'
import { MAX_FOTOS, type Cancha, type CanchaFoto } from '../../types/canchas'
import ConfirmDialog from './ConfirmDialog'

interface CanchaPhotosProps {
  cancha: Cancha
  // Called after a photo was added or removed so the list can be reloaded.
  onChanged: () => Promise<void>
  onError: (message: string) => void
}

const CanchaPhotos = ({ cancha, onChanged, onError }: CanchaPhotosProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<CanchaFoto | null>(null)

  const { fotos } = cancha
  const [cover, ...others] = fotos
  const full = fotos.length >= MAX_FOTOS

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      await onChanged()
    } catch (err) {
      onError(err instanceof AvatarUploadError ? err.message : getAuthErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await run(() => uploadCanchaFoto(cancha.id, file))
  }

  const handleConfirmRemove = async () => {
    const foto = removing
    setRemoving(null)
    if (foto) await run(() => canchasService.removeFoto(cancha.id, foto.id))
  }

  return (
    <section aria-label={`Fotos de ${cancha.nombre}`} className="flex flex-col gap-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-container-low">
        {cover ? (
          <img
            src={cover.url}
            alt={`Foto principal de ${cancha.nombre}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant">
            <span aria-hidden="true" className="material-symbols-outlined text-4xl">
              photo_camera
            </span>
            <span className="text-sm">Todavía no cargaste fotos</span>
          </div>
        )}
        {cover && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setRemoving(cover)}
            aria-label="Quitar la foto principal"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary-container/80 text-on-primary transition-opacity hover:opacity-100 disabled:opacity-60"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">
              close
            </span>
          </button>
        )}
      </div>

      {others.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {others.map((foto, index) => (
            <li key={foto.id} className="relative aspect-[16/10] overflow-hidden rounded-xl">
              <img
                src={foto.url}
                alt={`Foto ${index + 2} de ${cancha.nombre}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => setRemoving(foto)}
                aria-label={`Quitar la foto ${index + 2}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-container/80 text-on-primary disabled:opacity-60"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-base">
                  close
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={FOTO_ACCEPT}
        className="hidden"
        aria-label={`Elegir una foto para ${cancha.nombre}`}
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={busy || full}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-xl bg-surface-container py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-xl">
          add_a_photo
        </span>
        {busy ? 'Procesando...' : full ? 'Llegaste al máximo de fotos' : 'Agregar foto'}
        <span className="text-on-surface-variant">
          ({fotos.length}/{MAX_FOTOS})
        </span>
      </button>
      <p className="text-xs text-on-surface-variant">
        JPG, PNG o WebP de hasta 5 MB. La primera foto es la portada que ven los jugadores.
      </p>

      <ConfirmDialog
        open={removing !== null}
        title="Quitar foto"
        message="¿Quitás esta foto de la cancha? Los jugadores dejan de verla."
        confirmLabel="Sí, quitar"
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </section>
  )
}

export default CanchaPhotos
