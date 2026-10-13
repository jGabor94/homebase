import type { FC } from "react";
import Image from "next/image";

interface Props { title: string; description: string; illustration?: "home" | "notes"; greeting?: string }
const AppPageHeader: FC<Props> = ({ title, description, illustration = "home", greeting }) => {
  return (
    <section className="relative mb-6 flex min-h-44 items-center justify-between gap-4 overflow-hidden py-4 sm:mb-8 sm:min-h-48">
      <div className="relative z-10 max-w-2xl sm:max-w-[55%] xl:max-w-2xl">
        {greeting && <p className="mb-3 text-sm font-medium text-action-warm">{greeting}</p>}
        <h1 className="text-[clamp(2rem,5vw,3.75rem)] font-extrabold leading-[1.06] tracking-[-0.05em]">{title}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
      </div>
      <div className="pointer-events-none absolute right-0 bottom-0 h-48 w-[75%] opacity-25 [mask-image:linear-gradient(to_right,transparent,black_30%)] sm:w-[65%] sm:opacity-100 xl:relative xl:h-56 xl:w-[660px] xl:max-w-[50%] xl:shrink-0 xl:[mask-image:none]">
        <Image src={`/images/homebase/${illustration}-wide.webp`} alt="" loading="eager" fill
          sizes="(min-width: 1280px) 660px, (min-width: 640px) 65vw, 75vw"
          className="object-contain object-bottom-right" />
      </div>
    </section>
  );
};
export default AppPageHeader;
