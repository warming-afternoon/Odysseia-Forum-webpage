import type { components } from "@shared-types/openapi";

import type { Booklist, BooklistItem, PaginatedResponse } from "@/entities/booklist/types";

export type Tournament = Booklist;
export type TournamentItem = BooklistItem;
export type TournamentInfo = components["schemas"]["TournamentInfo-Output"];

export type TournamentCreateRequest =
  components["schemas"]["TournamentCreateRequest"];
export type TournamentCreateResponse =
  components["schemas"]["TournamentCreateResponse"];
export type TournamentUpdateRequest =
  components["schemas"]["TournamentUpdateRequest"];
export type TournamentItemAddData =
  components["schemas"]["TournamentItemAddData"];
export type TournamentItemUpdateRequest =
  components["schemas"]["TournamentItemUpdateRequest"];

export type PaginatedTournaments = PaginatedResponse<Tournament>;
export type PaginatedTournamentItems = PaginatedResponse<TournamentItem>;

