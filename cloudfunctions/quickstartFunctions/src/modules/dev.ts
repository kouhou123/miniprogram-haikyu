import { success, ApiResponse } from "../core/response";
import { db } from "../core/cloud";
import { Collections } from "../db/collections";
import { WxContext } from "../core/context";

// 测试用 mock 用户：普通用户「高」与管理员用户「宋」
// 管理员通过同时写入 organizers 白名单来获得组织者权限
const MOCK_USERS = [
  {
    openid: "mock_user_gao",
    nickName: "高",
    avatarUrl: "",
    phone: "13800000001",
    isOrganizer: false,
  },
  {
    openid: "mock_admin_song",
    nickName: "宋",
    avatarUrl: "",
    phone: "13900000002",
    isOrganizer: true,
  },
];

// 测试用：直接加入组织者白名单的真实 openid（开发者本人账号）
const ADMIN_OPENIDS = ["ouWND3Q_lhJpLy08zT-gDZdjM1ww"];

// 按 openid 幂等地写入用户（存在则更新，不存在则创建）
async function upsertUser(u: (typeof MOCK_USERS)[number], now: number) {
  const users = db.collection(Collections.USERS);
  const existing = await users.where({ openid: u.openid }).get();
  const base = {
    openid: u.openid,
    nickName: u.nickName,
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    updatedAt: now,
  };
  if (existing.data.length === 0) {
    const res = await users.add({ data: { ...base, createdAt: now } });
    return { _id: res._id, ...base };
  }
  const id = existing.data[0]._id;
  await users.doc(id).update({ data: base });
  return { _id: id, ...base };
}

// 幂等地把管理员加入 organizers 白名单
async function ensureOrganizer(openid: string, now: number) {
  const organizers = db.collection(Collections.ORGANIZERS);
  const existing = await organizers.where({ openid }).get();
  if (existing.data.length === 0) {
    await organizers.add({ data: { openid, createdAt: now } });
  }
}

// 测试用：在「普通用户 / 管理员」之间切换当前登录用户的身份
// 通过增删 organizers 白名单实现，返回切换后的 isOrganizer
export async function toggleOrganizer(
  _data: any,
  ctx: WxContext
): Promise<ApiResponse> {
  const openid = ctx.openid;
  if (!openid) {
    return success({ isOrganizer: false });
  }
  const organizers = db.collection(Collections.ORGANIZERS);
  const existing = await organizers.where({ openid }).get();
  if (existing.data.length > 0) {
    await organizers.where({ openid }).remove();
    return success({ isOrganizer: false });
  }
  await organizers.add({ data: { openid, createdAt: Date.now() } });
  return success({ isOrganizer: true });
}

// 生成测试用 mock 数据：普通用户「高」+ 管理员用户「宋」
export async function seedMockUsers(
  _data: any,
  _ctx: WxContext
): Promise<ApiResponse> {
  const now = Date.now();
  const result: any[] = [];
  for (const u of MOCK_USERS) {
    const saved = await upsertUser(u, now);
    if (u.isOrganizer) {
      await ensureOrganizer(u.openid, now);
    }
    result.push({ ...saved, isOrganizer: u.isOrganizer });
  }
  // 把开发者本人真实 openid 加入组织者白名单
  for (const openid of ADMIN_OPENIDS) {
    await ensureOrganizer(openid, now);
  }
  return success({ users: result, admins: ADMIN_OPENIDS });
}
