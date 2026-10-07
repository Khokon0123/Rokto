"use client";

import Image from "next/image";
import { useT } from "@/components/LocaleProvider";
import { cardClass } from "@/components/styles";
import { TEAM } from "@/config/app";

// Same pattern as /register and /search: the page headline lives in the red hero band
// (SiteHeader), so this content starts with a negative margin to sit under it.
export default function TeamPage() {
  const t = useT();
  return (
    <div className="relative -mt-14 space-y-5">
      <div className={`${cardClass} space-y-5`}>
        <p className="text-base text-muted">{t.team.intro}</p>
        <ul className="space-y-4">
          {TEAM.map((person) => (
            <li key={person.name} className="flex items-center gap-4">
              <Image
                src={person.photo}
                alt={person.name}
                width={72}
                height={72}
                className="h-[72px] w-[72px] shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-ink">{person.name}</p>
                <p className="text-base text-muted">{person.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
