import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BarrioCombobox from '../../components/common/BarrioCombobox'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import FormField from '../../components/common/FormField'
import { useAuth } from '../../hooks/useAuth'
import { AVATAR_ACCEPT, AvatarUploadError } from '../../services/avatar.service'
import type { Role } from '../../types/auth'
import { getAuthErrorMessage } from '../Auth/authError'

const USER_HOME = '/canchas'

const ROLE_LABELS: Record<Role, string> = {
  PLAYER: 'Jugador',
  OWNER: 'Dueño',
}

const completionOf = (...fields: string[]) =>
  Math.round((fields.filter((field) => field.trim() !== '').length / fields.length) * 100)

const ProfilePage = () => {
  const { user, updateProfile, uploadAvatar, removeAvatar } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [nombre, setNombre] = useState(user?.nombre ?? '')
  const [telefono, setTelefono] = useState(user?.telefono ?? '')
  const [barrioPontevedra, setBarrioPontevedra] = useState(user?.barrioPontevedra ?? '')
  const [comboboxKey, setComboboxKey] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const completion = completionOf(nombre, telefono, barrioPontevedra)
  const roleLabel = ROLE_LABELS[user.rol]

  const runPhotoAction = async (action: () => Promise<unknown>) => {
    setPhotoError(null)
    setPhotoBusy(true)
    try {
      await action()
    } catch (err) {
      setPhotoError(err instanceof AvatarUploadError ? err.message : getAuthErrorMessage(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  const handlePhotoSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void runPhotoAction(() => uploadAvatar(file))
  }

  const handlePhotoRemove = () => void runPhotoAction(removeAvatar)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setConfirming(true)
  }

  const handleReset = () => {
    setNombre(user.nombre)
    setTelefono(user.telefono ?? '')
    setBarrioPontevedra(user.barrioPontevedra ?? '')
    setComboboxKey((key) => key + 1)
    setError(null)
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await updateProfile({
        nombre,
        telefono: telefono || undefined,
        barrioPontevedra: barrioPontevedra || undefined,
      })
      navigate(USER_HOME, { replace: true })
    } catch (err) {
      setConfirming(false)
      setError(getAuthErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 md:px-8 lg:px-12 lg:py-10">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex max-w-2xl flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-secondary" />
            <span className="font-display text-eyebrow-badge uppercase tracking-widest text-secondary">
              Configuración de {roleLabel}
            </span>
            <span className="text-xs text-outline-variant">/</span>
            <span className="font-display text-eyebrow-badge uppercase text-on-surface-variant">
              Pontevedra
            </span>
          </div>
          <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
            Mi perfil deportivo
          </h1>
          <p className="text-sm text-on-surface-variant">
            Completá tus datos de jugador. Tu barrio define a qué convocatorias de Falta Uno llegás.
          </p>
        </div>

        <div className="flex w-full flex-col gap-1 rounded-2xl bg-surface-container-low p-4 shadow-sm sm:w-72">
          <div className="flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-on-surface">
              Estado del perfil
            </span>
            <span className="text-sm font-bold text-secondary">{completion}% completado</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div
              className="h-full rounded-full bg-secondary-container transition-all duration-500 ease-out"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-primary-container p-6 text-on-primary shadow-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-secondary-container/20 blur-3xl" />

            <div className="relative z-10 flex items-center justify-between">
              <span className="font-display text-headline-sm uppercase tracking-wider">
                Ponte la Diez
              </span>
              <span className="text-label-sm uppercase tracking-widest text-secondary-container">
                Carnet digital
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2 py-2">
              <div className="relative">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-b from-secondary-container to-surface-tint p-1 shadow-lg">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-container">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Tu foto de perfil"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-6xl text-on-primary-container"
                      >
                        person
                      </span>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  className="hidden"
                  onChange={handlePhotoSelected}
                />
                <button
                  type="button"
                  aria-label="Cambiar foto de perfil"
                  disabled={photoBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container text-on-secondary-fixed shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                    {photoBusy ? 'hourglass_top' : 'photo_camera'}
                  </span>
                </button>
              </div>
              <p className="text-xs text-secondary-fixed-dim">JPG, PNG o WebP hasta 5 MB</p>
              {user.avatarUrl && (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={handlePhotoRemove}
                  className="text-xs font-semibold text-secondary-container underline-offset-2 hover:underline disabled:opacity-60"
                >
                  Quitar foto
                </button>
              )}
              {photoError && (
                <p
                  role="alert"
                  className="rounded-lg bg-error-container px-3 py-2 text-xs text-on-error-container"
                >
                  {photoError}
                </p>
              )}
              <h2 className="text-center font-display text-headline-lg uppercase leading-none tracking-tight text-surface-bright">
                {nombre.trim() || 'Tu nombre'}
              </h2>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-container" />
                <span className="font-display text-eyebrow-badge uppercase tracking-wider text-secondary-fixed">
                  {roleLabel} activo · Pontevedra
                </span>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-3 rounded-xl bg-surface-tint/25 p-3 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tint/40">
                <span aria-hidden="true" className="material-symbols-outlined text-xl">
                  location_on
                </span>
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-label-sm uppercase text-secondary-fixed-dim">
                  Zona / Barrio
                </span>
                <span className="truncate text-sm font-bold text-surface-bright">
                  {barrioPontevedra || 'Sin barrio elegido'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-surface-container p-4">
            <span
              aria-hidden="true"
              className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-secondary"
            >
              shield
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-on-surface">Datos de tu cuenta</span>
              <p className="text-xs text-on-surface-variant">
                Tu email identifica tu cuenta y no se puede cambiar desde acá.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-8 rounded-3xl bg-surface-container-lowest p-6 shadow-sm md:p-10 lg:col-span-7"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container font-display text-headline-sm text-on-primary">
                1
              </span>
              <h3 className="font-display text-headline-sm uppercase text-on-surface">
                Datos personales y ubicación
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                id="perfil-nombre"
                label="Nombre y apellido"
                icon="person"
                required
                minLength={2}
                maxLength={80}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <BarrioCombobox
                key={comboboxKey}
                id="perfil-barrio"
                label="Barrio habitual en Pontevedra"
                value={barrioPontevedra}
                onChange={setBarrioPontevedra}
              />
              <FormField
                id="perfil-telefono"
                label="Celular / WhatsApp (opcional)"
                icon="chat"
                type="tel"
                maxLength={30}
                placeholder="+54 9 11 xxxx-xxxx"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
              <FormField
                id="perfil-email"
                label="Email de la cuenta"
                icon="lock"
                type="email"
                readOnly
                value={user.email}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {error}
            </p>
          )}

          <div className="flex w-full flex-col items-center justify-end gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleReset}
              className="h-12 w-full rounded-full bg-surface-container px-6 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:w-auto"
            >
              Restablecer
            </button>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-8 font-display text-headline-sm uppercase tracking-wide text-on-primary shadow-md transition-all hover:bg-secondary active:scale-95 sm:w-auto"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-xl">
                save
              </span>
              Guardar cambios
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Guardar cambios"
        message="¿Querés guardar los cambios de tu perfil?"
        confirmLabel={saving ? 'Guardando...' : 'Sí, guardar'}
        onConfirm={handleConfirm}
        onCancel={() => !saving && setConfirming(false)}
      />
    </main>
  )
}

export default ProfilePage
