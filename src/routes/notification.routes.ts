import { Router } from "express";
import {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get("/", getNotificationsHandler);
router.get("/unread-count", getUnreadCountHandler);
router.patch("/read-all", markAllAsReadHandler);
router.patch("/:id/read", markAsReadHandler);
router.delete("/:id", deleteNotificationHandler);

export const notificationRouter = router;
