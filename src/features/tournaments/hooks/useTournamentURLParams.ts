import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export interface TournamentParams {
  sort: number;
  page: number;
}

export function useTournamentURLParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo((): TournamentParams => {
    const sort = Number.parseInt(searchParams.get("sort") || "4", 10);
    const page = Number.parseInt(searchParams.get("page") || "1", 10);

    return {
      sort: Number.isNaN(sort) ? 4 : sort,
      page: Number.isNaN(page) ? 1 : page,
    };
  }, [searchParams]);

  const setParams = useCallback(
    (updates: Partial<TournamentParams>) => {
      const current = {
        sort: searchParams.get("sort") || "4",
        page: searchParams.get("page") || "1",
      };
      const next = { ...current };

      if (updates.sort !== undefined) next.sort = String(updates.sort);
      if (updates.page !== undefined) next.page = String(updates.page);

      if (
        updates.sort !== undefined &&
        String(updates.sort) !== current.sort
      ) {
        next.page = "1";
      }

      const newSearchParams = new URLSearchParams();
      if (next.sort !== "4") newSearchParams.set("sort", next.sort);
      if (next.page !== "1") newSearchParams.set("page", next.page);

      setSearchParams(newSearchParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return {
    params,
    setParams,
  } as const;
}

