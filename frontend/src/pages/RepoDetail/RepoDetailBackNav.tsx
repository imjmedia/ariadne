import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Back link to repository list; shared across detail loading / error / main layout. */
export function RepoDetailBackNav({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-10 gap-2 rounded-xl border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]',
        className,
      )}
      asChild
    >
      <Link to="/repos">
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Repos
      </Link>
    </Button>
  );
}
