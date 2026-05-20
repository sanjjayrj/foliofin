interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

export default function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizes[size]} rounded-full border-2 border-[#2a2a42] border-t-[#7c3aed] animate-spin`}
      />
      {label && <p className="text-sm text-[#9898b8]">{label}</p>}
    </div>
  );
}
