import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from "../validators/notification.validator.js";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../services/notification.service.js";
import { sendSuccess, sendPaginatedSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const getNotificationsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = getNotificationsQuerySchema.parse(req.query);
    const result = await getNotifications(userId, query);

    sendPaginatedSuccess(
      res,
      200,
      "Notifications fetched successfully",
      result.data,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
};

export const getUnreadCountHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const result = await getUnreadNotificationCount(userId);

    sendSuccess(res, 200, "Unread notification count fetched successfully", result);
  } catch (error) {
    next(error);
  }
};

export const markAsReadHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const { id } = notificationIdParamSchema.parse(req.params);
    const notification = await markNotificationAsRead(userId, id);

    sendSuccess(res, 200, "Notification marked as read successfully", notification);
  } catch (error) {
    next(error);
  }
};

export const markAllAsReadHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const result = await markAllNotificationsAsRead(userId);

    sendSuccess(res, 200, "All notifications marked as read successfully", result);
  } catch (error) {
    next(error);
  }
};

export const deleteNotificationHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const { id } = notificationIdParamSchema.parse(req.params);
    await deleteNotification(userId, id);

    sendSuccess(res, 200, "Notification deleted successfully");
  } catch (error) {
    next(error);
  }
};
