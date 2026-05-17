import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        secondary: "border-transparent bg-secondary/20 text-foreground",
        muted: "border-border bg-muted text-muted-foreground",
        success: "border-transparent bg-emerald-500/12 text-emerald-700",
        warning: "border-transparent bg-amber-500/14 text-amber-700",
        danger: "border-transparent bg-rose-500/14 text-rose-700"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
