// 集合名常量，避免字符串硬编码
export const Collections = {
  USERS: "users",
  EVENTS: "events",
  REGISTRATIONS: "registrations",
  PHOTOS: "photos",
  ORGANIZERS: "organizers",
} as const;

// 活动状态
export const EventStatus = {
  OPEN: "open", // 报名中
  FULL: "full", // 已满
  CLOSED: "closed", // 已结束/关闭
  CANCELLED: "cancelled", // 已取消
} as const;

// 报名状态
export const RegistrationStatus = {
  REGISTERED: "registered",
  CANCELLED: "cancelled",
} as const;
