import { Skeleton } from '@/components/ui/skeleton';
import { RepoDetailBackNav } from './RepoDetailBackNav';
import { repoDetailPageClass, sectionHeaderClass, sectionShellClass } from './layoutClasses';

/** Loading skeleton for repository detail. */
export function RepoDetailLoading() {
  return (
    <div className={repoDetailPageClass}>
      <RepoDetailBackNav />
      <section className={sectionShellClass}>
        <div className={sectionHeaderClass}>
          <Skeleton className="h-8 w-full max-w-2xl rounded-lg" />
        </div>
        <div className="space-y-4 px-5 py-6 sm:px-6">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-5 w-24 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-5 w-48 rounded-lg" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </section>
    </div>
  );
}
