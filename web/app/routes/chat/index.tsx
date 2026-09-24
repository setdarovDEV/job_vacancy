import { useQueryClient } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router";

import type { Route } from "./+types/index";
import type { ShellHandle } from "../site";
import { ConversationList } from "./ConversationList";
import { Thread } from "./Thread";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { connect, onRealtime } from "~/shared/realtime/socket";
import { metaT } from "~/shared/seo/meta";
import { seo } from "~/shared/seo/seo";
import { EmptyState } from "~/shared/ui/EmptyState";

// An open thread is a full screen on phones: its own glass top bar and composer replace the site
// header and the tab bar. The list keeps the normal shell.
export const handle: ShellHandle = {
  bare: true,
  tabBar: ({ params }) => !params.id,
  mobileHeader: ({ params }) => !params.id,
};

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({ title: `${t("nav.messages")} | ${t("brand.name")}`, path: location.pathname, noindex: true });
}

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
    <div className="h-app md:container-page md:py-5 lg:py-6">
      <div className="flex h-full overflow-hidden md:surface-card md:rounded-sheet">
        <aside aria-labelledby="chat-title" className={cn("flex min-w-0 flex-1 md:w-72 md:flex-none lg:w-88 md:border-r md:border-line", id && "max-md:hidden")}>
          <ConversationList activeId={id} />
        </aside>
        {/* Named for the view transition: on phones the thread slides in over the list (app.css). */}
        <section
          aria-label={t("chatPage.messages")}
          aria-labelledby={id ? "thread-title" : undefined}
          className={cn("relative flex min-w-0 flex-1 flex-col bg-paper", !id && "max-md:hidden")}
          style={{ viewTransitionName: "chat-thread" }}
        >
          {id ? <Thread key={id} id={id} /> : (
            <div className="relative grid flex-1 place-items-center">
              <GirihPattern reveal={false} />
              <EmptyState icon={<MessagesSquare />} headingAs="h2" title={t("chat.pickTitle")} body={t("chat.pickBody")} className="relative" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
