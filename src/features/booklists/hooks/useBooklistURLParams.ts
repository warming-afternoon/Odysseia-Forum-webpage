import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type BooklistScope = "public" | "mine" | "collected";

export interface BooklistParams {
  scope: BooklistScope;
  keywords: string;
  sort: number;
  page: number;
}

export function useBooklistURLParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo((): BooklistParams => {
    const scope = (searchParams.get("scope") as BooklistScope) || "public";
    const keywords = searchParams.get("q") || "";
    const sort = parseInt(searchParams.get("sort") || "4", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    return {
      scope: ["public", "mine", "collected"].includes(scope) ? scope : "public",
      keywords,
      sort: isNaN(sort) ? 4 : sort,
      page: isNaN(page) ? 1 : page,
    };
  }, [searchParams]);

  const setParams = useCallback(
    (updates: Partial<BooklistParams>) => {
      const current = {
        scope: searchParams.get("scope") || "public",
        q: searchParams.get("q") || "",
        sort: searchParams.get("sort") || "4",
        page: searchParams.get("page") || "1",
      };

      const next = { ...current };

      if (updates.scope !== undefined) next.scope = updates.scope;
      if (updates.keywords !== undefined) next.q = updates.keywords;
      if (updates.sort !== undefined) next.sort = String(updates.sort);
      if (updates.page !== undefined) next.page = String(updates.page);

      // If scope, keywords or sort changes, reset page to 1
      if (
        (updates.scope !== undefined && updates.scope !== current.scope) ||
        (updates.keywords !== undefined && updates.keywords !== current.q) ||
        (updates.sort !== undefined && String(updates.sort) !== current.sort)
      ) {
        next.page = "1";
      }

      const newSP = new URLSearchParams();
      if (next.scope !== "public") newSP.set("scope", next.scope);
      if (next.q) newSP.set("q", next.q);
      if (next.sort !== "4") newSP.set("sort", next.sort);
      if (next.page !== "1") newSP.set("page", next.page);

      setSearchParams(newSP, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return {
    params,
    setParams,
  } as const;
}
