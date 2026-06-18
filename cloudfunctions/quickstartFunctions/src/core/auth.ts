import { db } from "./cloud";
import { Collections } from "../db/collections";
import { BizError, ErrorCode } from "./errors";

// 校验已登录，返回 openid
export function requireLogin(openid?: string): string {
  if (!openid) {
    throw new BizError(ErrorCode.UNAUTHORIZED, "未登录或无法获取用户身份");
  }
  return openid;
}

// 是否在组织者白名单中
export async function isOrganizer(openid: string): Promise<boolean> {
  if (!openid) return false;
  const res = await db
    .collection(Collections.ORGANIZERS)
    .where({ openid })
    .count();
  return res.total > 0;
}

// 校验组织者权限
export async function requireOrganizer(openid?: string): Promise<string> {
  const id = requireLogin(openid);
  const ok = await isOrganizer(id);
  if (!ok) {
    throw new BizError(ErrorCode.FORBIDDEN, "无活动组织者权限");
  }
  return id;
}
