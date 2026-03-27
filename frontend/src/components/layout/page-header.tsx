import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="sticky top-12 md:top-0 z-30 bg-background">
      <div className="container mx-auto max-w-7xl px-4 flex items-center justify-between h-11">
        <h1 className="text-sm font-medium text-foreground">{title}</h1>
        {children}
      </div>
      <div className="h-px bg-border" />
    </div>
  );
}
