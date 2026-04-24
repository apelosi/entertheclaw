import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'disabled'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[#C41E3A] hover:bg-[#9B1B30] text-[#F0EDE8] border border-[#C41E3A] hover:border-[#9B1B30] hover:shadow-[0_0_12px_rgba(196,30,58,0.12)]',
  secondary:
    'bg-transparent border border-[#3A3A3A] text-[#F0EDE8] hover:bg-[#161616]',
  gold: 'bg-[#B8860B] hover:bg-[#D4A017] text-black border border-[#B8860B] hover:border-[#D4A017] font-semibold',
  ghost:
    'bg-transparent border border-transparent text-[#888880] hover:text-[#F0EDE8]',
  disabled:
    'bg-[#161616] border border-[#242424] text-[#444440] cursor-not-allowed pointer-events-none',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
  lg: 'h-12 px-6 text-[15px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, disabled, ...props }, ref) => {
    const effectiveVariant = disabled ? 'disabled' : variant
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded font-medium tracking-[0.01em] whitespace-nowrap transition-all duration-[120ms] ease-out',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C41E3A] focus-visible:ring-offset-1 focus-visible:ring-offset-[#080808]',
          variants[effectiveVariant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
