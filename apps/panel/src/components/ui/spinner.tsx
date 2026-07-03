import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex', className)}>
      <Loader2
        aria-hidden="true"
        className="h-full w-full animate-spin text-[hsl(192_100%_58%)]"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      {/* Glowing ring spinner */}
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
        <div
          className="absolute inset-0 rounded-full border-2 border-t-[hsl(192_100%_58%)] border-r-transparent border-b-transparent border-l-transparent animate-spin"
          style={{ animationDuration: '0.85s' }}
        />
        <div
          className="absolute inset-1 rounded-full border border-t-[hsl(265_80%_68%/0.5)] border-r-transparent border-b-transparent border-l-transparent animate-spin"
          style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
        />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
    </div>
  );
}
