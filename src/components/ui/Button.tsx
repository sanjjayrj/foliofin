import { forwardRef } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center gap-2 font-medium rounded-[10px] cursor-pointer select-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants: Record<Variant, string> = {
      primary: 'bg-[#7c3aed] text-white hover:bg-[#6d28d9] active:scale-95 shadow-lg shadow-purple-900/30',
      secondary: 'bg-[#1f1f32] text-[#f0f0ff] border border-[#2a2a42] hover:bg-[#28283f] hover:border-[#7c3aed]/50 active:scale-95',
      ghost: 'text-[#9898b8] hover:text-[#f0f0ff] hover:bg-[#1f1f32] active:scale-95',
      danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-95',
    };

    const sizes: Record<Size, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
