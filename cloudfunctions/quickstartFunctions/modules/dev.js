"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedMockUsers = seedMockUsers;
const response_1 = require("../core/response");
const cloud_1 = require("../core/cloud");
const collections_1 = require("../db/collections");
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
// 按 openid 幂等地写入用户（存在则更新，不存在则创建）
async function upsertUser(u, now) {
    const users = cloud_1.db.collection(collections_1.Collections.USERS);
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
async function ensureOrganizer(openid, now) {
    const organizers = cloud_1.db.collection(collections_1.Collections.ORGANIZERS);
    const existing = await organizers.where({ openid }).get();
    if (existing.data.length === 0) {
        await organizers.add({ data: { openid, createdAt: now } });
    }
}
// 生成测试用 mock 数据：普通用户「高」+ 管理员用户「宋」
async function seedMockUsers(_data, _ctx) {
    const now = Date.now();
    const result = [];
    for (const u of MOCK_USERS) {
        const saved = await upsertUser(u, now);
        if (u.isOrganizer) {
            await ensureOrganizer(u.openid, now);
        }
        result.push({ ...saved, isOrganizer: u.isOrganizer });
    }
    return (0, response_1.success)({ users: result });
}
