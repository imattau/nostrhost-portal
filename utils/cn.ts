import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn-vue style helper: merges conditional class lists (`clsx`) and
// resolves conflicting Tailwind utility classes (`twMerge`), e.g. letting a
// consumer override a component's default `p-4` with `p-2`.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
