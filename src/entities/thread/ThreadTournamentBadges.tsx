import { Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { Thread } from "@/entities/thread/types";

interface ThreadTournamentBadgesProps {
  thread: Thread;
  variant: "icon" | "inline" | "tags";
  onNavigate?: () => void;
}

function getTournamentInfos(thread: Thread) {
  const infos = thread.tournament_info_list || [];
  const seen = new Set<string>();

  return infos.filter((info) => {
    const id = String(info.booklist_id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function ThreadTournamentBadges({
  thread,
  variant,
  onNavigate,
}: ThreadTournamentBadgesProps) {
  const navigate = useNavigate();
  const tournamentInfos = getTournamentInfos(thread);
  const isTournamentThread = Boolean(thread.is_tournament) || tournamentInfos.length > 0;

  if (!isTournamentThread) return null;

  const navigateToTournament = (
    info: { booklist_id: string | number; booklist_name: string },
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    const booklistId = String(info.booklist_id || "").trim();
    if (!booklistId) return;
    onNavigate?.();
    navigate(`/tournaments/${booklistId}`);
  };

  if (variant === "icon") {
    const firstInfo = tournamentInfos[0];

    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-(--od-accent)"
        aria-label="参赛帖子"
        title={firstInfo ? `参赛帖子：${firstInfo.booklist_name}` : "参赛帖子"}
      >
        <Trophy className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (variant === "inline") {
    const firstInfo = tournamentInfos[0];

    return (
      <span
        className="inline-flex items-center gap-1 rounded-full text-(--od-accent)"
        title={firstInfo ? `参赛帖子：${firstInfo.booklist_name}` : "参赛帖子"}
      >
        <Trophy className="h-3.5 w-3.5" />
        <span>参赛</span>
      </span>
    );
  }

  if (tournamentInfos.length === 0) {
    return (
      <section className="mb-6">
        <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-(--od-text-primary)">
          <Trophy className="h-4 w-4 text-(--od-accent)" />
          所属赛事
        </h3>
        <div className="flex flex-wrap gap-2">
          <span className="od-pill-chip text-(--od-accent)">参赛帖子</span>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-(--od-text-primary)">
        <Trophy className="h-4 w-4 text-(--od-accent)" />
        所属赛事
      </h3>
      <div className="flex flex-wrap gap-2">
        {tournamentInfos.map((info) => (
          <button
            key={String(info.booklist_id)}
            type="button"
            onClick={(event) => navigateToTournament(info, event)}
            className="od-pill-chip text-(--od-accent) hover:text-(--od-accent-hover)"
            title={`查看赛事：${info.booklist_name}`}
          >
            {info.booklist_name}
          </button>
        ))}
      </div>
    </section>
  );
}
