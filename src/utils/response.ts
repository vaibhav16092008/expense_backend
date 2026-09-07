import { Response } from "express";

export const sendSuccess = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T
): Response => {
  const payload: { success: boolean; message: string; data?: T } = {
    success: true,
    message,
  };

  if (data !== undefined) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};

export const sendPaginatedSuccess = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  }
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

