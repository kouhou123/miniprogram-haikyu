"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.add = add;
exports.list = list;
exports.remove = remove;
const response_1 = require("../core/response");
const auth_1 = require("../core/auth");
const cloud_1 = require("../core/cloud");
const collections_1 = require("../db/collections");
const validate_1 = require("../core/validate");
const errors_1 = require("../core/errors");
// 为活动添加照片（仅活动发布者）
async function add(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const fileID = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.fileID, "fileID");
    const evRes = await cloud_1.db
        .collection(collections_1.Collections.EVENTS)
        .doc(eventId)
        .get()
        .catch(() => null);
    if (!evRes || !evRes.data) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "活动不存在");
    }
    if (evRes.data.organizerOpenid !== openid) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "只能为自己发布的活动上传照片");
    }
    const now = Date.now();
    const doc = { eventId, fileID, uploaderOpenid: openid, createdAt: now };
    const res = await cloud_1.db.collection(collections_1.Collections.PHOTOS).add({ data: doc });
    return (0, response_1.success)({ _id: res._id, ...doc });
}
// 活动照片列表
async function list(data, _ctx) {
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const res = await cloud_1.db
        .collection(collections_1.Collections.PHOTOS)
        .where({ eventId })
        .orderBy("createdAt", "desc")
        .get();
    return (0, response_1.success)({ list: res.data });
}
// 删除照片（仅上传者），同时删除云存储文件
async function remove(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const id = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data._id, "_id");
    const photoRes = await cloud_1.db
        .collection(collections_1.Collections.PHOTOS)
        .doc(id)
        .get()
        .catch(() => null);
    if (!photoRes || !photoRes.data) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "照片不存在");
    }
    if (photoRes.data.uploaderOpenid !== openid) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "只能删除自己上传的照片");
    }
    try {
        await cloud_1.cloud.deleteFile({ fileList: [photoRes.data.fileID] });
    }
    catch (e) {
        /* 云存储删除失败不阻断记录删除 */
    }
    await cloud_1.db.collection(collections_1.Collections.PHOTOS).doc(id).remove();
    return (0, response_1.success)({ _id: id });
}
