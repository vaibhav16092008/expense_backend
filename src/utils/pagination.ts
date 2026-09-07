export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalCount: number
): PaginationMeta {
  const totalPages = Math.ceil(totalCount / limit);
  const hasMore = page < totalPages;

  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasMore,
  };
}

export function getPaginationParams(
  page?: number,
  limit?: number
): { skip: number; take: number; page: number; limit: number } {
  const validPage = page && page >= 1 ? page : 1;
  const validLimit = limit && limit >= 1 ? (limit > 100 ? 100 : limit) : 20;
  const skip = (validPage - 1) * validLimit;

  return {
    skip,
    take: validLimit,
    page: validPage,
    limit: validLimit,
  };
}
