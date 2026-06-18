"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
exports.update = update;
exports.list = list;
exports.byDate = byDate;
exports.detail = detail;
exports.close = close;
exports.cancel = cancel;
const response_1 = require("../core/response");
const auth_1 = require("../core/auth");
const cloud_1 = require("../core/cloud");
const collections_1 = require("../db/collections");
const validate_1 = require("../core/validate");
const errors_1 = require("../core/errors");
const events = () => cloud_1.db.collection(collections_1.Collections.EVENTS);
async function getEventOrThrow(id) {
    const res = await events()
        .doc(id)
        .get()
        .catch(() => null);
    if (!res || !res.data) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "活动不存在");
    }
    return res.data;
}
// 发布活动（组织者）
async function create(data, ctx) {
    const openid = await (0, auth_1.requireOrganizer)(ctx.openid);
    const title = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.title, "title");
    const startTime = (0, validate_1.requireNumber)(data === null || data === void 0 ? void 0 : data.startTime, "startTime");
    const endTime = (0, validate_1.requireNumber)(data === null || data === void 0 ? void 0 : data.endTime, "endTime");
    const capacity = (0, validate_1.requireNumber)(data === null || data === void 0 ? void 0 : data.capacity, "capacity");
    if (endTime < startTime) {
        throw new errors_1.BizError(errors_1.ErrorCode.PARAM_INVALID, "结束时间不能早于开始时间");
    }
    if (capacity <= 0) {
        throw new errors_1.BizError(errors_1.ErrorCode.PARAM_INVALID, "人数上限必须大于 0");
    }
    const now = Date.now();
    const doc = {
        title,
        description: (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.description),
        coverImage: (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.coverImage),
        location: (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.location),
        startTime,
        endTime,
        capacity,
        enrolledCount: 0,
        organizerOpenid: openid,
        status: collections_1.EventStatus.OPEN,
        createdAt: now,
        updatedAt: now,
    };
    const res = await events().add({ data: doc });
    return (0, response_1.success)({ _id: res._id, ...doc });
}
// 编辑活动（仅本人发布）
async function update(data, ctx) {
    const openid = await (0, auth_1.requireOrganizer)(ctx.openid);
    const id = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data._id, "_id");
    const cur = await getEventOrThrow(id);
    if (cur.organizerOpenid !== openid) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "只能编辑自己发布的活动");
    }
    const patch = { updatedAt: Date.now() };
    if (data.title !== undefined)
        patch.title = (0, validate_1.requireString)(data.title, "title");
    if (data.description !== undefined)
        patch.description = (0, validate_1.optionalString)(data.description);
    if (data.coverImage !== undefined)
        patch.coverImage = (0, validate_1.optionalString)(data.coverImage);
    if (data.location !== undefined)
        patch.location = (0, validate_1.optionalString)(data.location);
    if (data.startTime !== undefined)
        patch.startTime = (0, validate_1.requireNumber)(data.startTime, "startTime");
    if (data.endTime !== undefined)
        patch.endTime = (0, validate_1.requireNumber)(data.endTime, "endTime");
    if (data.capacity !== undefined) {
        const cap = (0, validate_1.requireNumber)(data.capacity, "capacity");
        if (cap < cur.enrolledCount) {
            throw new errors_1.BizError(errors_1.ErrorCode.PARAM_INVALID, "人数上限不能小于已报名人数");
        }
        patch.capacity = cap;
        // 调整名额后重新计算是否已满
        if (cur.status === collections_1.EventStatus.FULL && cap > cur.enrolledCount) {
            patch.status = collections_1.EventStatus.OPEN;
        }
        else if (cur.status === collections_1.EventStatus.OPEN && cap <= cur.enrolledCount) {
            patch.status = collections_1.EventStatus.FULL;
        }
    }
    await events().doc(id).update({ data: patch });
    return (0, response_1.success)({ _id: id, ...patch });
}
// 活动列表（分页，可按状态/我发布的筛选）
async function list(data, ctx) {
    const page = Math.max(1, Number(data === null || data === void 0 ? void 0 : data.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(data === null || data === void 0 ? void 0 : data.pageSize) || 20));
    const filter = {};
    if (data === null || data === void 0 ? void 0 : data.status) {
        filter.status = data.status;
    }
    if ((data === null || data === void 0 ? void 0 : data.mine) && ctx.openid) {
        filter.organizerOpenid = ctx.openid;
    }
    const res = await events()
        .where(filter)
        .orderBy("startTime", "desc")
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
    return (0, response_1.success)({ list: res.data, page, pageSize });
}
// 某一天的活动列表（按日历日期查询，附带当前用户是否已报名）
async function byDate(data, ctx) {
    const dayTs = (0, validate_1.requireNumber)(data === null || data === void 0 ? void 0 : data.date, "date");
    const d = new Date(dayTs);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const res = await events()
        .where({ startTime: cloud_1._.gte(dayStart).and(cloud_1._.lt(dayEnd)) })
        .orderBy("startTime", "asc")
        .get();
    const list = res.data || [];
    // 标记当前用户已报名的活动，便于前端展示报名/取消按钮
    if (ctx.openid && list.length > 0) {
        const ids = list.map((e) => e._id);
        const regs = await cloud_1.db
            .collection(collections_1.Collections.REGISTRATIONS)
            .where({
            eventId: cloud_1._.in(ids),
            openid: ctx.openid,
            status: collections_1.RegistrationStatus.REGISTERED,
        })
            .get();
        const registeredSet = new Set(regs.data.map((r) => r.eventId));
        list.forEach((e) => {
            e.registered = registeredSet.has(e._id);
        });
    }
    else {
        list.forEach((e) => {
            e.registered = false;
        });
    }
    return (0, response_1.success)({ list });
}
// 活动详情，附带当前用户的报名记录
async function detail(data, ctx) {
    const id = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data._id, "_id");
    const event = await getEventOrThrow(id);
    let myRegistration = null;
    if (ctx.openid) {
        const reg = await cloud_1.db
            .collection(collections_1.Collections.REGISTRATIONS)
            .where({ eventId: id, openid: ctx.openid, status: "registered" })
            .get();
        myRegistration = reg.data[0] || null;
    }
    return (0, response_1.success)({ event, myRegistration });
}
// 关闭活动（结束报名）
async function close(data, ctx) {
    const openid = await (0, auth_1.requireOrganizer)(ctx.openid);
    const id = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data._id, "_id");
    const cur = await getEventOrThrow(id);
    if (cur.organizerOpenid !== openid) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "只能操作自己发布的活动");
    }
    await events()
        .doc(id)
        .update({ data: { status: collections_1.EventStatus.CLOSED, updatedAt: Date.now() } });
    return (0, response_1.success)({ _id: id, status: collections_1.EventStatus.CLOSED });
}
// 取消活动
async function cancel(data, ctx) {
    const openid = await (0, auth_1.requireOrganizer)(ctx.openid);
    const id = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data._id, "_id");
    const cur = await getEventOrThrow(id);
    if (cur.organizerOpenid !== openid) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "只能操作自己发布的活动");
    }
    await events()
        .doc(id)
        .update({ data: { status: collections_1.EventStatus.CANCELLED, updatedAt: Date.now() } });
    return (0, response_1.success)({ _id: id, status: collections_1.EventStatus.CANCELLED });
}
