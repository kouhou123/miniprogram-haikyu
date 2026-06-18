"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.updateProfile = updateProfile;
const response_1 = require("../core/response");
const auth_1 = require("../core/auth");
const cloud_1 = require("../core/cloud");
const collections_1 = require("../db/collections");
const validate_1 = require("../core/validate");
// 登录：首次自动创建用户，返回用户信息与是否组织者
async function login(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const now = Date.now();
    const users = cloud_1.db.collection(collections_1.Collections.USERS);
    const existing = await users.where({ openid }).get();
    const organizer = await (0, auth_1.isOrganizer)(openid);
    const nickName = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.nickName);
    const avatarUrl = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.avatarUrl);
    let user;
    if (existing.data.length === 0) {
        const doc = {
            openid,
            nickName,
            avatarUrl,
            phone: "",
            createdAt: now,
            updatedAt: now,
        };
        const addRes = await users.add({ data: doc });
        user = { _id: addRes._id, ...doc };
    }
    else {
        user = existing.data[0];
        const patch = { updatedAt: now };
        if (nickName)
            patch.nickName = nickName;
        if (avatarUrl)
            patch.avatarUrl = avatarUrl;
        await users.doc(user._id).update({ data: patch });
        user = { ...user, ...patch };
    }
    return (0, response_1.success)({ user, isOrganizer: organizer });
}
// 更新个人资料
async function updateProfile(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const patch = { updatedAt: Date.now() };
    if ((data === null || data === void 0 ? void 0 : data.nickName) !== undefined)
        patch.nickName = (0, validate_1.optionalString)(data.nickName);
    if ((data === null || data === void 0 ? void 0 : data.avatarUrl) !== undefined)
        patch.avatarUrl = (0, validate_1.optionalString)(data.avatarUrl);
    if ((data === null || data === void 0 ? void 0 : data.phone) !== undefined)
        patch.phone = (0, validate_1.optionalString)(data.phone);
    const res = await cloud_1.db
        .collection(collections_1.Collections.USERS)
        .where({ openid })
        .update({ data: patch });
    return (0, response_1.success)({ updated: res.stats.updated });
}
