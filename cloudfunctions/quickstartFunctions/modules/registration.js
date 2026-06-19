"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.adminCreate = adminCreate;
exports.update = update;
exports.cancel = cancel;
exports.remove = remove;
exports.list = list;
exports.myList = myList;
exports.eventRoster = eventRoster;
const response_1 = require("../core/response");
const auth_1 = require("../core/auth");
const cloud_1 = require("../core/cloud");
const collections_1 = require("../db/collections");
const validate_1 = require("../core/validate");
const errors_1 = require("../core/errors");
function registrations() {
    return cloud_1.db.collection(collections_1.Collections.REGISTRATIONS);
}
function events() {
    return cloud_1.db.collection(collections_1.Collections.EVENTS);
}
function normalizeRegistration(reg, openid = "", organizer = false) {
    const createdByAdmin = !!reg.createdByAdmin;
    const canEdit = organizer || (!!openid && reg.openid === openid && !createdByAdmin);
    const canCancel = !!openid && reg.openid === openid && !createdByAdmin;
    return {
        ...reg,
        name: reg.name || reg.userName || "",
        remark: reg.remark || "",
        canEdit,
        canCancel,
        canRemove: organizer,
    };
}
async function getEventOrThrow(eventId) {
    const res = await events()
        .doc(eventId)
        .get()
        .catch(() => null);
    if (!res || !res.data) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "活动不存在");
    }
    return res.data;
}
function assertCanJoin(ev) {
    if (ev.status !== collections_1.EventStatus.OPEN) {
        throw new errors_1.BizError(errors_1.ErrorCode.EVENT_CLOSED, "活动未开放报名");
    }
    if ((ev.enrolledCount || 0) >= (ev.capacity || 0)) {
        throw new errors_1.BizError(errors_1.ErrorCode.EVENT_FULL, "名额已满");
    }
}
async function addRegistration(eventId, doc) {
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
        assertCanJoin(ev);
        const now = Date.now();
        const addRes = await transaction.collection(collections_1.Collections.REGISTRATIONS).add({
            data: {
                ...doc,
                eventId,
                status: collections_1.RegistrationStatus.REGISTERED,
                createdAt: now,
                updatedAt: now,
                cancelledAt: 0,
            },
        });
        const newCount = (ev.enrolledCount || 0) + 1;
        const patch = { enrolledCount: cloud_1._.inc(1), updatedAt: now };
        if (newCount >= ev.capacity) {
            patch.status = collections_1.EventStatus.FULL;
        }
        await transaction
            .collection(collections_1.Collections.EVENTS)
            .doc(eventId)
            .update({ data: patch });
        await transaction.commit();
        return { _id: addRes._id, enrolledCount: newCount };
    }
    catch (e) {
        try {
            await transaction.rollback();
        }
        catch (_e) {
            /* ignore rollback errors */
        }
        throw e;
    }
}
async function decrementEventCount(eventId) {
    const transaction = await cloud_1.db.startTransaction();
    try {
        const eventDoc = await transaction
            .collection(collections_1.Collections.EVENTS)
            .doc(eventId)
            .get()
            .catch(() => null);
        const ev = eventDoc && eventDoc.data;
        if (!ev) {
            await transaction.commit();
            return;
        }
        const now = Date.now();
        const patch = {
            enrolledCount: cloud_1._.inc(-1),
            updatedAt: now,
        };
        if (ev.status === collections_1.EventStatus.FULL) {
            patch.status = collections_1.EventStatus.OPEN;
        }
        await transaction
            .collection(collections_1.Collections.EVENTS)
            .doc(eventId)
            .update({ data: patch });
        await transaction.commit();
    }
    catch (e) {
        try {
            await transaction.rollback();
        }
        catch (_e) {
            /* ignore rollback errors */
        }
        throw e;
    }
}
async function register(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const name = (0, validate_1.requireString)((data === null || data === void 0 ? void 0 : data.name) || (data === null || data === void 0 ? void 0 : data.userName), "name");
    const remark = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.remark);
    const existing = await registrations()
        .where({ eventId, openid, status: collections_1.RegistrationStatus.REGISTERED })
        .get();
    if (existing.data.length > 0) {
        throw new errors_1.BizError(errors_1.ErrorCode.ALREADY_REGISTERED, "您已报名该活动");
    }
    const result = await addRegistration(eventId, {
        openid,
        name,
        remark,
        userName: name,
        userPhone: (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.userPhone),
        createdByAdmin: false,
    });
    return (0, response_1.success)({ eventId, ...result });
}
async function adminCreate(data, ctx) {
    const adminOpenid = await (0, auth_1.requireOrganizer)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const name = (0, validate_1.requireString)((data === null || data === void 0 ? void 0 : data.name) || (data === null || data === void 0 ? void 0 : data.userName), "name");
    const remark = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.remark);
    const result = await addRegistration(eventId, {
        openid: "",
        name,
        remark,
        userName: name,
        userPhone: "",
        createdByAdmin: true,
        createdByOpenid: adminOpenid,
    });
    return (0, response_1.success)({ eventId, ...result });
}
async function update(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const id = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data._id, "_id");
    const name = (0, validate_1.requireString)((data === null || data === void 0 ? void 0 : data.name) || (data === null || data === void 0 ? void 0 : data.userName), "name");
    const remark = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.remark);
    const regRes = await registrations()
        .doc(id)
        .get()
        .catch(() => null);
    if (!regRes || !regRes.data) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "报名记录不存在");
    }
    const organizer = await (0, auth_1.isOrganizer)(openid);
    const reg = regRes.data;
    const ownRecord = reg.openid === openid && !reg.createdByAdmin;
    if (!organizer && !ownRecord) {
        throw new errors_1.BizError(errors_1.ErrorCode.FORBIDDEN, "无权修改该报名");
    }
    if (reg.status !== collections_1.RegistrationStatus.REGISTERED) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_REGISTERED, "报名记录已取消");
    }
    const patch = {
        name,
        remark,
        userName: name,
        updatedAt: Date.now(),
    };
    await registrations().doc(id).update({ data: patch });
    return (0, response_1.success)({ _id: id, ...patch });
}
async function cancel(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    const existing = await registrations()
        .where({ eventId, openid, status: collections_1.RegistrationStatus.REGISTERED })
        .get();
    if (existing.data.length === 0) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_REGISTERED, "您未报名该活动");
    }
    const reg = existing.data[0];
    const now = Date.now();
    await registrations()
        .doc(reg._id)
        .update({
        data: {
            status: collections_1.RegistrationStatus.CANCELLED,
            cancelledAt: now,
            updatedAt: now,
        },
    });
    await decrementEventCount(eventId);
    return (0, response_1.success)({ eventId, _id: reg._id });
}
async function remove(data, ctx) {
    await (0, auth_1.requireOrganizer)(ctx.openid);
    const id = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data._id, "_id");
    const regRes = await registrations()
        .doc(id)
        .get()
        .catch(() => null);
    if (!regRes || !regRes.data) {
        throw new errors_1.BizError(errors_1.ErrorCode.NOT_FOUND, "报名记录不存在");
    }
    const reg = regRes.data;
    if (reg.status !== collections_1.RegistrationStatus.REGISTERED) {
        return (0, response_1.success)({ _id: id, removed: false });
    }
    const now = Date.now();
    await registrations()
        .doc(id)
        .update({
        data: {
            status: collections_1.RegistrationStatus.CANCELLED,
            cancelledAt: now,
            updatedAt: now,
            removedByAdmin: true,
        },
    });
    await decrementEventCount(reg.eventId);
    return (0, response_1.success)({ _id: id, removed: true });
}
async function list(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const organizer = await (0, auth_1.isOrganizer)(openid);
    const eventId = (0, validate_1.optionalString)(data === null || data === void 0 ? void 0 : data.eventId);
    const filter = { openid, status: collections_1.RegistrationStatus.REGISTERED };
    if (eventId)
        filter.eventId = eventId;
    const regs = await registrations()
        .where(filter)
        .orderBy("createdAt", "desc")
        .get();
    const eventIds = Array.from(new Set(regs.data.map((r) => r.eventId)));
    const eventsMap = {};
    if (eventIds.length > 0) {
        const evRes = await events()
            .where({ _id: cloud_1._.in(eventIds) })
            .get();
        evRes.data.forEach((e) => {
            eventsMap[e._id] = e;
        });
    }
    const listData = regs.data.map((r) => ({
        ...normalizeRegistration(r, openid, organizer),
        event: eventsMap[r.eventId] || null,
    }));
    return (0, response_1.success)({ list: listData, total: listData.length, isOrganizer: organizer });
}
async function myList(data, ctx) {
    return list(data, ctx);
}
async function eventRoster(data, ctx) {
    const openid = (0, auth_1.requireLogin)(ctx.openid);
    const eventId = (0, validate_1.requireString)(data === null || data === void 0 ? void 0 : data.eventId, "eventId");
    await getEventOrThrow(eventId);
    const organizer = await (0, auth_1.isOrganizer)(openid);
    const regs = await registrations()
        .where({ eventId, status: collections_1.RegistrationStatus.REGISTERED })
        .orderBy("createdAt", "asc")
        .get();
    const listData = regs.data.map((r) => normalizeRegistration(r, openid, organizer));
    return (0, response_1.success)({ list: listData, total: listData.length, isOrganizer: organizer });
}
