import { cn } from '@/lib/utils';

export type AriadneMarkdownVariant = 'docs' | 'chat' | 'analysis';

export const docsProseClass = cn(
  'markdown-doc max-w-[68rem] space-y-4 text-[15px] leading-relaxed text-[var(--foreground)]',
  '[&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:scroll-mt-28 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-[var(--foreground)]',
  '[&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:border-b [&_h2]:border-[var(--border)] [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--foreground)]',
  '[&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:scroll-mt-28 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[var(--foreground)]',
  '[&_h4]:mt-6 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-[var(--foreground)]',
  '[&_p]:my-3 [&_p]:text-[var(--foreground)]',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:marker:text-[var(--foreground-muted)]',
  '[&_strong]:font-semibold [&_strong]:text-[var(--foreground)]',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--border)] [&_blockquote]:bg-[color-mix(in_oklch,var(--muted)_35%,transparent)] [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:text-[var(--foreground-muted)]',
  '[&_pre]:my-4 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-[color-mix(in_oklch,var(--muted)_42%,var(--card))] [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:shadow-inner',
  '[&_code]:rounded-md [&_code]:border [&_code]:border-[var(--border)] [&_code]:bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]',
  '[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px]',
  '[&_a]:font-medium [&_a]:text-[var(--primary)] [&_a]:underline [&_a]:underline-offset-4 [&_a]:transition-opacity hover:[&_a]:opacity-90',
  '[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-[var(--border)] [&_table]:text-sm',
  '[&_th]:border-b [&_th]:border-[var(--border)] [&_th]:bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border-b [&_td]:border-[var(--border)] [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top',
  '[&_tr:last-child_td]:border-b-0 [&_hr]:my-8 [&_hr]:border-[var(--border)]',
  '[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-[var(--border)]',
);

export const chatProseClass = cn(
  '[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:font-semibold',
  '[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_pre]:overflow-x-auto',
  '[&_table]:w-full [&_th]:border [&_td]:border [&_td]:px-2 [&_td]:py-1',
);

export function proseClassForVariant(variant: AriadneMarkdownVariant): string {
  switch (variant) {
    case 'docs':
      return docsProseClass;
    case 'chat':
      return chatProseClass;
    case 'analysis':
      return '';
  }
}
