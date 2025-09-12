import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft transition-smooth border-2 border-primary hover:border-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-destructive hover:border-destructive/90",
        outline: "border-2 border-primary bg-background hover:bg-primary hover:text-primary-foreground transition-smooth",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-2 border-secondary hover:border-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground border-2 border-transparent hover:border-accent/20",
        link: "text-primary underline-offset-4 hover:underline border-2 border-transparent",
        hero: "bg-gradient-primary text-primary-foreground hover:shadow-glow transform hover:scale-105 transition-bounce shadow-medium border-2 border-white/30 hover:border-white/50",
        accent: "bg-gradient-hero text-primary-foreground hover:shadow-glow transform hover:scale-105 transition-bounce shadow-medium font-semibold border-2 border-white/40 hover:border-white/60",
        outline_primary: "border-2 border-white/50 text-primary-foreground bg-transparent hover:bg-white/10 hover:border-white/70 transition-smooth",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
