"use client";

// Адаптер над MentionTextarea из @toimetdev/pathlogs-core. Пакетная версия
// идентична по поведению (скрытое поле name="mentions" с csv id упомянутых —
// надёжный источник для уведомлений), отличается лишь именем пропа: people
// вместо members. MemberDTO { id, name } присваивается к AvatarPerson.
import { MentionTextarea as BaseMentionTextarea } from "@toimetdev/pathlogs-core";
import type { MemberDTO } from "@/lib/types";

export function MentionTextarea({
  members,
  ...rest
}: {
  name: string;
  members: MemberDTO[];
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  return <BaseMentionTextarea people={members} {...rest} />;
}
