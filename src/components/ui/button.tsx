import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

// Estilo tipo shadcn/ui. Las variantes replican los botones actuales de styles.css
// (.primary, .primary.success) para que el cambio no se note.
export const buttonVariants = cva(
  'inline-flex items-center justify-center font-semibold transition active:scale-95 disabled:pointer-events-none disabled:opacity-35',
  {
    variants: {
      variant: {
        default: 'rounded-[18px] bg-card-2 px-[18px] py-4 text-white',
        primary:
          'w-full rounded-[22px] py-5 text-[1.15rem] font-bold text-white [background:var(--grad)] shadow-[0_8px_24px_rgba(99,102,241,0.35)]',
        success:
          'mt-[18px] w-full rounded-[22px] py-5 text-[1.15rem] font-bold text-[#00210d] [background:var(--grad-green)] shadow-[0_8px_24px_rgba(48,209,88,0.3)]',
        ghost: 'bg-transparent text-blue',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
