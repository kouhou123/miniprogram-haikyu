"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireLogin = requireLogin;
exports.isOrganizer = isOrganizer;
exports.requireOrganizer = requireOrganizer;
const cloud_1 = require("./cloud");
const collections_1 = require("../db/collections");
const errors_1 = require("./errors");
// 校验已登录，返回 openid
function requireLogin(openid) {
    if (!openid) {
        throw new errors_1.BizError(errors_1.ErrorCode.UNAUTHORIZED, "未登录或无法获取用户身份");
    }
    return openid;
}
// 是否在组织者白名单中
async function isOrganizer(openid) {
    if (!openid)
        return false;
    const res = await cloud_1.db
        .collection(collections_1.Collections.ORGANIZERS)
        .where({ openid })
        .count();
    return res.total > 0;
}
// 校验组织者权限
async function requireOrganizer(openid) {
    const id = requireLogin(openid);
    const ok = await isOrganizer(id);
    if (!ok) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "无活动组织者权限");
    }
    return id;
}
