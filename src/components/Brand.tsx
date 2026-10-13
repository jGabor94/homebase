import type { FC } from "react";
import { House } from "lucide-react";
import { cn } from "cn";

interface Props { compact?: boolean; inverted?: boolean }
const Brand: FC<Props> = ({ compact = false, inverted = false }) => {

  return <span className="inline-flex items-center gap-3"><House aria-hidden="true" className={cn("size-9 shrink-0", inverted ? "text-cyan-300" : "text-primary")} strokeWidth={2.6} /><span><span className="block text-2xl font-bold tracking-tight">homebase</span>{!compact && <span className={cn("mt-0.5 block text-xs font-normal", inverted ? "text-sidebar-foreground/70" : "text-muted-foreground")}>A család közös tere</span>}</span></span>;
};
export default Brand;
