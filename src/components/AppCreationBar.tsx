import type { FC } from "react";
import { LoaderCircle, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  pending?: boolean;
  icon?: LucideIcon;
}

const AppCreationBar: FC<Props> = ({ title, description, actionLabel, onAction, disabled, pending, icon: Icon = Plus }) => {

  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-2xl border border-border border-l-4 border-l-action-warm bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <Button type="button" variant="warm" size="lg" onClick={onAction} disabled={disabled || pending} aria-busy={pending || undefined} className="w-full whitespace-normal shadow-sm sm:w-auto">
        {pending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : <Icon aria-hidden="true" data-icon="inline-start" />}
        {actionLabel}
      </Button>
    </section>
  );
};

export default AppCreationBar;
