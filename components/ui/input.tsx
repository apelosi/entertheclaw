import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
          'w-full rounded border border-[#242424] bg-[#161616] px-3.5 py-2.5',
          'font-ui text-[15px] text-[#F0EDE8] outline-none',
          'placeholder:text-[#444440]',
          'transition-[border-color,box-shadow] duration-[120ms] ease-out',
          'focus:border-[#C41E3A] focus:shadow-[0_0_0_3px_rgba(196,30,58,0.12)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-[#E8405A] focus:border-[#E8405A] focus:shadow-[0_0_0_3px_rgba(232,64,90,0.12)]',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-[#E8405A]">{error}</p>
      )}
    </div>
  )
)
Input.displayName = 'Input'
