"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.cancel = cancel;
exports.myList = myList;
exports.eventRoster = eventRoster;
const response_1 = require("../core/response");
const auth_1 = require("../core/auth");
const cloud_1 = require("../core/cloud");
const collections_1 = require("../db/collections");
const validate_1 = require("../core/validate");
const errors_1 = require("../core/errors");
// 报名（事务保证不超额）
async function register(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const userName = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.userName);
    const userPhone = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.userPhone);
    // 是否已有有效报名
    const existing = await cloud_1.db
        .collection(collections_1.Collections.REGISTRATIONS)
        .where({ eventId, openid, status: collections_1.RegistrationStatus.REGISTERED })
        .get();
    if (existing.data.length > 0) {
        throw new errors_1.BizError(errors_1.ErrorCode.ALREADY_REGISTERED, "您已报名该活动");
    }
    const transaction = await cloud_1.db.startTransaction();
    try {
        const eventDoc = await transaction
            .collection(collections_1.Collections.EVENTS)
            .doc(eventId)
            .get();
        const ev = eventDoc.data;
        if (!ev) {
            await transaction.rollback();
            throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "活动不存在");
        }
        if (ev.status !== collections_1.EventStatus.OPEN) {
            await transaction.rollback();
            throw new errors_1.BizError(errors_1.ErrorCode.EVENT_CLOSED, "活动已结束或已关闭报名");
        }
        if (ev.enrolledCount >= ev.capacity) {
            await transaction.rollback();
            throw new errors_1.BizError(errors_1.ErrorCode.EVENT_FULL, "名额已满");
        }
        const now = Date.now();
        await transaction.collection(collections_1.Collections.REGISTRATIONS).add({
            data: {
                eventId,
                openid,
                userName,
                userPhone,
                status: collections_1.RegistrationStatus.REGISTERED,
                createdAt: now,
                cancelledAt: 0,
            },
        });
        const newCount = ev.enrolledCount + 1;
        const patch = { enrolledCount: cloud_1._.inc(1), updatedAt: now };
        if (newCount >= ev.capacity) {
            patch.status = collections_1.EventStatus.FULL;
        }
        await transaction
            .collection(collections_1.Collections.EVENTS)
            .doc(eventId)
            .update({ data: patch });
        await transaction.commit();
        return (0, response_1.success)({ eventId, enrolledCount: newCount });
    }
    catch (e) {
        if (e instanceof errors_1.BizError)
            throw e;
        try {
            await transaction.rollback();
        }
        catch (_e) {
            /* 忽略回滚异常 */
        }
        throw e;
    }
}
// 取消报名（事务回退名额）
async function cancel(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const existing = await cloud_1.db
        .collection(collections_1.Collections.REGISTRATIONS)
        .where({ eventId, openid, status: collections_1.RegistrationStatus.REGISTERED })
        .get();
    if (existing.data.length === 0) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_REGISTERED, "您未报名该活动");
    }
    const regId = existing.data[0]._id;
    const transaction = await cloud_1.db.startTransaction();
    try {
        const eventDoc = await transaction
            .collection(collections_1.Collections.EVENTS)
            .doc(eventId)
            .get();
        const ev = eventDoc.data;
        const now = Date.now();
        await transaction
            .collection(collections_1.Collections.REGISTRATIONS)
            .doc(regId)
            .update({
            data: { status: collections_1.RegistrationStatus.CANCELLED, cancelledAt: now },
        });
        if (ev) {
            const patch = { enrolledCount: cloud_1._.inc(-1), updatedAt: now };
            // 取消后若原为已满则重新开放
            if (ev.status === collections_1.EventStatus.FULL) {
                patch.status = collections_1.EventStatus.OPEN;
            }
            await transaction
                .collection(collections_1.Collections.EVENTS)
                .doc(eventId)
                .update({ data: patch });
        }
        await transaction.commit();
        return (0, response_1.success)({ eventId });
    }
    catch (e) {
        try {
            await transaction.rollback();
        }
        catch (_e) {
            /* 忽略回滚异常 */
        }
        throw e;
    }
}
// 我的报名列表（附带活动信息）
async function myList(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const status = (data === null || data === void 0 ? void 0 : data.status) || collections_1.RegistrationStatus.REGISTERED;
    const regs = await cloud_1.db
        .collection(collections_1.Collections.REGISTRATIONS)
        .where({ openid, status })
        .orderBy("createdAt", "desc")
        .get();
    const eventIds = regs.data.map((r) => r.eventId);
    const eventsMap = {};
    if (eventIds.length > 0) {
        const evRes = await cloud_1.db
            .collection(collections_1.Collections.EVENTS)
            .where({ _id: cloud_1._.in(eventIds) })
            .get();
        evRes.data.forEach((e) => {
            eventsMap[e._id] = e;
        });
    }
    const listData = regs.data.map((r) => ({
        ...r,
        event: eventsMap[r.eventId] || null,
    }));
    return (0, response_1.success)({ list: listData });
}
// 活动报名名单（仅活动发布者可看）
async function eventRoster(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const evRes = await cloud_1.db
        .collection(collections_1.Collections.EVENTS)
        .doc(eventId)
        .get()
        .catch(() => null);
    if (!evRes || !evRes.data) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "活动不存在");
    }
    if (evRes.data.organizerOpenid !== openid) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "只能查看自己发布的活动报名名单");
    }
    const regs = await cloud_1.db
        .collection(collections_1.Collections.REGISTRATIONS)
        .where({ eventId, status: collections_1.RegistrationStatus.REGISTERED })
        .orderBy("createdAt", "asc")
        .get();
    return (0, response_1.success)({ list: regs.data, total: regs.data.length });
}
