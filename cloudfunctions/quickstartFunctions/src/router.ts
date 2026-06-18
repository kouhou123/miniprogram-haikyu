import { ApiResponse, fail } from "./core/response";
import { BizError, ErrorCode } from "./core/errors";
import { getContext, WxContext } from "./core/context";
import * as userModule from "./modules/user";
import * as eventModule from "./modules/event";
import * as registrationModule from "./modules/registration";
import * as photoModule from "./modules/photo";

export interface RequestEvent {
  type: string;
  data?: any;
}

export type Handler = (
  data: any,
  ctx: WxContext
) => Promise<ApiResponse> | ApiResponse;

// 路由表：type -> handler，命名空间风格 模块.动作
const routes: Record<string, Handler> = {
  // 用户
  "user.login": userModule.login,
  "user.updateProfile": userModule.updateProfile,
  // 活动
  "event.create": eventModule.create,
  "event.update": eventModule.update,
  "event.list": eventModule.list,
  "event.activeDates": eventModule.activeDates,
  "event.byDate": eventModule.byDate,
  "event.detail": eventModule.detail,
  "event.close": eventModule.close,
  "event.cancel": eventModule.cancel,
  // 报名
  "registration.register": registrationModule.register,
  "registration.adminCreate": registrationModule.adminCreate,
  "registration.cancel": registrationModule.cancel,
  "registration.update": registrationModule.update,
  "registration.remove": registrationModule.remove,
  "registration.list": registrationModule.list,
  "registration.myList": registrationModule.myList,
  "registration.eventRoster": registrationModule.eventRoster,
  // 照片
  "photo.add": photoModule.add,
  "photo.list": photoModule.list,
  "photo.delete": photoModule.remove,
};

// 统一分发 + 异常处理
export async function dispatch(event: RequestEvent): Promise<ApiResponse> {
  const { type, data } = event || ({} as RequestEvent);
  const handler = routes[type];
  if (!handler) {
    return fail(ErrorCode.NOT_FOUND, `未知的接口类型: ${type}`);
  }

  const ctx = getContext();
  try {
    return await handler(data || {}, ctx);
  } catch (e) {
    if (e instanceof BizError) {
      return fail(e.code, e.message);
    }
    console.error(`[${type}] 系统错误`, e);
    return fail(ErrorCode.SYSTEM_ERROR, "系统错误，请稍后重试");
  }
}
