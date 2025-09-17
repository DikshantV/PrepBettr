/**
 * Notification System Index
 * 
 * Barrel export for the notification system.
 * This provides a clean API while maintaining backward compatibility.
 */

// Main service exports
export { 
  notificationService
} from '../notification-service';

// Type exports
export type {
  NotificationEvent,
  NotificationType,
  NotificationChannel
} from '../notification-service';

// Legacy compatibility - re-export the main service as default
export { notificationService as default } from '../notification-service';

