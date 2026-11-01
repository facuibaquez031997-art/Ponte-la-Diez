import { useState, type InputHTMLAttributes } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: string
}

const FormField = ({ label, icon, id, type, ...props }: FormFieldProps) => {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-sm uppercase tracking-wider text-on-surface">
        {label}
      </label>
      <div className="relative flex items-center">
        <span
          aria-hidden="true"
          className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-on-surface-variant"
        >
          {icon}
        </span>
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          className={`w-full rounded-xl bg-surface-container-low py-3 pl-11 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary-container ${
            isPassword ? 'pr-12' : 'pr-4'
          }`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-3.5 flex items-center justify-center p-1 text-on-surface-variant hover:text-on-surface"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              {revealed ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

export default FormField
