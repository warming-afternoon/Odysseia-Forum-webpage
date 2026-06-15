export const tournamentKeys = {
  all: ["tournaments"] as const,
  lists: () => [...tournamentKeys.all, "list"] as const,
  list: (params: {
    pageIndex: number;
    pageSize: number;
    sortMethod: number;
    sortOrder?: "asc" | "desc";
  }) => [...tournamentKeys.lists(), params] as const,
  detail: (booklistId: string | number) =>
    [...tournamentKeys.all, "detail", String(booklistId)] as const,
  items: (booklistId: string | number) =>
    [...tournamentKeys.all, "items", String(booklistId)] as const,
  coverItems: (booklistId: string | number) =>
    [...tournamentKeys.all, "cover-items", String(booklistId)] as const,
};
