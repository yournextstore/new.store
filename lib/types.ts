export interface Store {
  id: string;
  creatorUserId: string;
  promptText: string;
  storeUrl: string;
  heroImageUrl: string | null;
  createdAt: string;
  netVotes: number;
  isStarred?: boolean;
  userVote?: 'up' | 'down' | null;
}

export interface PaginatedStoresResponse {
  data: Store[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface UserVotesMap {
  [storeId: string]: 'up' | 'down';
}
