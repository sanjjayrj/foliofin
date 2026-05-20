import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#9898b8]">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a7a] pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={clsx(
              'w-full bg-[#0f0f1a] border border-[#2a2a42] rounded-[10px] text-[#f0f0ff] placeholder-[#5a5a7a]',
              'py-2.5 text-sm transition-all duration-150',
              'focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20',
              'hover:border-[#3a3a52]',
              icon ? 'pl-10 pr-4' : 'px-4',
              error && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
