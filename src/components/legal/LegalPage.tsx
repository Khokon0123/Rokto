"use client";

import { useT } from "@/components/LocaleProvider";
import { cardClass } from "@/components/styles";
import { CONTACT_EMAIL } from "@/config/app";
import { fmt } from "@/i18n";

type Sections = Array<[title: string, body: string]>;

/** L1: privacy notice and terms, both languages. Text marked [OWNER: ...] must be completed. */
export default function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const t = useT();
  const l = t.legal;
  const contact = fmt(l.contactBody, { email: CONTACT_EMAIL });
  const sections: Sections =
    kind === "privacy"
      ? [
          [l.publicTitle, l.publicBody],
          [l.hiddenTitle, l.hiddenBody],
          [l.processorsTitle, l.processorsBody],
          [l.keepTitle, l.keepBody],
          [l.ownerTitle, l.ownerBody],
          [l.contactTitle, contact],
        ]
      : [
          [l.termsUseTitle, l.termsUseBody],
          [l.termsDonorTitle, l.termsDonorBody],
          [t.eligibility.title, t.eligibility.disclaimer],
          [l.termsNoGuaranteeTitle, l.termsNoGuaranteeBody],
          [l.contactTitle, contact],
        ];

  return (
    <article className={`${cardClass} space-y-6`}>
      <h1 className="text-2xl font-bold text-ink">{kind === "privacy" ? l.privacyTitle : l.termsTitle}</h1>
      <p className="rounded-2xl bg-page p-4 text-sm font-medium text-muted">{l.draftNotice}</p>
      {sections.map(([title, body]) => (
        <section key={title} className="space-y-2">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="text-base text-ink">{body}</p>
        </section>
      ))}
    </article>
  );
}
