import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, label: "Disclaimer", short: "Info" },
  { num: 2, label: "Holdings", short: "ETFs" },
  { num: 3, label: "Themes", short: "Themes" },
  { num: 4, label: "Correlation", short: "Corr." },
  { num: 5, label: "Optimization", short: "Opt." },
  { num: 6, label: "Allocations", short: "Alloc." },
  { num: 7, label: "Review", short: "Review" },
];

interface ProgressStepperProps {
  current: number;
}

export function ProgressStepper({ current }: ProgressStepperProps) {
  return (
    <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border py-4 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isComplete = current > step.num;
          const isCurrent = current === step.num;
          return (
            <div key={step.num} className="flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-[background-color,border-color,color] duration-300",
                    isComplete && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary/20 border-2 border-primary text-primary",
                    !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : step.num}
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-wider uppercase transition-colors",
                    isCurrent ? "text-primary" : "text-muted-foreground",
                    "hidden sm:block"
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] tracking-wider uppercase transition-colors",
                    isCurrent ? "text-primary" : "text-muted-foreground",
                    "sm:hidden"
                  )}
                >
                  {step.short}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px w-4 sm:w-8 mx-1 sm:mx-2 transition-colors duration-300",
                    current > step.num ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
