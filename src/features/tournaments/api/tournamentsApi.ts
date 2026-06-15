import { booklistsApi } from "@/features/booklists/api/booklistsApi";
import type {
  PaginatedTournamentItems,
  PaginatedTournaments,
  Tournament,
} from "@/entities/tournament/types";

interface TournamentListRequest {
  pageIndex?: number;
  pageSize?: number;
  sortMethod?: number;
  sortOrder?: "asc" | "desc";
}

interface TournamentItemListRequest {
  limit?: number;
  offset?: number;
}

export const tournamentsApi = {
  list: async (
    params: TournamentListRequest = {},
  ): Promise<PaginatedTournaments> => {
    return booklistsApi.listPublic({
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      sortMethod: params.sortMethod,
      sortOrder: params.sortOrder,
      isTournament: true,
    });
  },

  getDetail: async (booklistId: string | number): Promise<Tournament> => {
    return booklistsApi.getDetail(booklistId);
  },

  listItems: async (
    booklistId: string | number,
    params: TournamentItemListRequest = {},
  ): Promise<PaginatedTournamentItems> => {
    return booklistsApi.listItems(booklistId, params);
  },
};
