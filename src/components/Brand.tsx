import { GraduationCap } from "lucide-react";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { appName, logoUrl, tagline } = useBranding();

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {logoUrl ? (
        <img src={logoUrl} alt={appName} className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold leading-tight">{appName}</span>
        {!compact && (
          <span className="block truncate text-[11px] text-muted-foreground">{tagline}</span>
        )}
      </span>
    </div>
  );
}
