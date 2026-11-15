interface ChatAvatarProps {
  nombre: string
  avatarUrl: string | null
  className?: string
}

/** Photo of the person, or a neutral icon when there is none. */
const ChatAvatar = ({ nombre, avatarUrl, className = 'h-10 w-10' }: ChatAvatarProps) => (
  <div
    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container ${className}`}
  >
    {avatarUrl ? (
      <img src={avatarUrl} alt={nombre} className="h-full w-full object-cover" />
    ) : (
      <span aria-hidden="true" className="material-symbols-outlined text-[24px] text-secondary">
        {'sports_soccer'}
      </span>
    )}
  </div>
)

export default ChatAvatar
