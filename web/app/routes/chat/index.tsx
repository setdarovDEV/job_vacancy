import { useQueryClient } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router";

import { ConversationList } from "./ConversationList";
import { Thread } from "./Thread";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { connect, onRealtime } from "~/shared/realtime/socket";
import { EmptyState } from "~/shared/ui/EmptyState";

export const handle = { bare: true };

export default function Chat() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Keep the conversation list fresh as messages arrive anywhere.
  useEffect(() => {
    connect();
    return onRealtime((e) => {
      if (e.type === "message.new" || e.type === "message.read" || e.type === "message.deleted") void qc.invalidateQueries({ queryKey: ["conversations"] });
    });
  }, [qc]);

  return (
    <div className="container-page h-app py-0 md:py-5">
      <div className="flex h-full overflow-hidden border-line bg-surface md:rounded-sheet md:border">
        <aside className={cn("w-full shrink-0 border-line md:w-80 md:border-r", id ? "hidden md:flex" : "flex")}>
          <ConversationList activeId={id} />
        </aside>
        <section className={cn("min-w-0 flex-1", id ? "flex" : "hidden md:flex")}>
          {id ? <Thread key={id} id={id} /> : (
            <div className="grid flex-1 place-items-center">
              <EmptyState icon={<MessagesSquare className="size-6" />} title={t("chat.pickTitle")} body={t("chat.pickBody")} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
