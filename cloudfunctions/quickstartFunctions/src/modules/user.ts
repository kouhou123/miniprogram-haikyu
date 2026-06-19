import { success, ApiResponse } from "../core/response";
import { requireLogin, isOrganizer } from "../core/auth";
import { db } from "../core/cloud";
import { Collections } from "../db/collections";
import { WxContext } from "../core/context";
import { optionalString } from "../core/validate";

// 登录：首次自动创建用户，返回用户信息与是否组织者
export async function login(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const now = Date.now();
  const users = db.collection(Collections.USERS);
  const existing = await users.where({ openid }).get();
  const organizer = await isOrganizer(openid);

  const nickName = optionalString(data?.nickName);
  const avatarUrl = optionalString(data?.avatarUrl);

  let user: any;
  if (existing.data.length === 0) {
    const doc = {
      openid,
      nickName,
      avatarUrl,
      motto: "",
      createdAt: now,
      updatedAt: now,
    };
    const addRes = await users.add({ data: doc });
    user = { _id: addRes._id, ...doc };
  } else {
    user = existing.data[0];
    const patch: any = { updatedAt: now };
    if (nickName) patch.nickName = nickName;
    if (avatarUrl) patch.avatarUrl = avatarUrl;
    await users.doc(user._id).update({ data: patch });
    user = { ...user, ...patch };
  }

  return success({ user, isOrganizer: organizer });
}

// 更新个人资料
export async function updateProfile(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const patch: any = { updatedAt: Date.now() };
  if (data?.nickName !== undefined) patch.nickName = optionalString(data.nickName);
  if (data?.avatarUrl !== undefined) patch.avatarUrl = optionalString(data.avatarUrl);
  if (data?.motto !== undefined) patch.motto = optionalString(data.motto);

  const res = await db
    .collection(Collections.USERS)
    .where({ openid })
    .update({ data: patch });

  return success({ updated: res.stats.updated });
}
