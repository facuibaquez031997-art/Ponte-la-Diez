interface ChatAvatarProps {
  nombre: string
  avatarUrl: string | null
  className?: string
  /** Green dot when connected, red dot when not. Left out, no dot is shown. */
  conectado?: boolean
}

/** Photo of the person, or a neutral icon when there is none, with an optional connected dot. */
const ChatAvatar = ({ nombre, avatarUrl, className = 'h-10 w-10', conectado }: ChatAvatarProps) => (
  <div className="relative shrink-0">
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-surface-container ${className}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={nombre} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="material-symbols-outlined text-[24px] text-secondary">
          {'sports_soccer'}
        </span>
      )}
    </div>
    {conectado !== undefined && (
      <span
        role="img"
        aria-label={conectado ? 'Conectado' : 'No conectado'}
        title={conectado ? 'Conectado' : 'No conectado'}
        className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-surface-container-lowest ${
          conectado ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
    )}
  </div>
)

export default ChatAvatar
