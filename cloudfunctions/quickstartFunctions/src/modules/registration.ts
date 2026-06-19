import { success, ApiResponse } from "../core/response";
import { requireLogin, isOrganizer, requireOrganizer } from "../core/auth";
import { db, _ } from "../core/cloud";
import {
  Collections,
  EventStatus,
  RegistrationStatus,
} from "../db/collections";
import { WxContext } from "../core/context";
import { requireString, optionalString } from "../core/validate";
import { BizError, ErrorCode } from "../core/errors";

function registrations() {
  return db.collection(Collections.REGISTRATIONS);
}

function events() {
  return db.collection(Collections.EVENTS);
}

function normalizeRegistration(reg: any, openid = "", organizer = false) {
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

async function getEventOrThrow(eventId: string): Promise<any> {
  const res = await events()
    .doc(eventId)
    .get()
    .catch(() => null);
  if (!res || !res.data) {
    throw new BizError(ErrorCode.NOT_FOUND, "活动不存在");
  }
  return res.data;
}

function assertCanJoin(ev: any) {
  if (ev.status !== EventStatus.OPEN) {
    throw new BizError(ErrorCode.EVENT_CLOSED, "活动未开放报名");
  }
  if ((ev.enrolledCount || 0) >= (ev.capacity || 0)) {
    throw new BizError(ErrorCode.EVENT_FULL, "名额已满");
  }
}

async function addRegistration(
  eventId: string,
  doc: Record<string, any>
): Promise<{ _id: string; enrolledCount: number }> {
  const transaction = await db.startTransaction();
  try {
    const eventDoc = await transaction
      .collection(Collections.EVENTS)
      .doc(eventId)
      .get();
    const ev = eventDoc.data;
    if (!ev) {
      await transaction.rollback();
      throw new BizError(ErrorCode.NOT_FOUND, "活动不存在");
    }
    assertCanJoin(ev);

    const now = Date.now();
    const addRes = await transaction.collection(Collections.REGISTRATIONS).add({
      data: {
        ...doc,
        eventId,
        status: RegistrationStatus.REGISTERED,
        createdAt: now,
        updatedAt: now,
        cancelledAt: 0,
      },
    });

    const newCount = (ev.enrolledCount || 0) + 1;
    const patch: any = { enrolledCount: _.inc(1), updatedAt: now };
    if (newCount >= ev.capacity) {
      patch.status = EventStatus.FULL;
    }
    await transaction
      .collection(Collections.EVENTS)
      .doc(eventId)
      .update({ data: patch });

    await transaction.commit();
    return { _id: addRes._id, enrolledCount: newCount };
  } catch (e) {
    try {
      await transaction.rollback();
    } catch (_e) {
      /* ignore rollback errors */
    }
    throw e;
  }
}

async function decrementEventCount(eventId: string): Promise<void> {
  const transaction = await db.startTransaction();
  try {
    const eventDoc = await transaction
      .collection(Collections.EVENTS)
      .doc(eventId)
      .get()
      .catch(() => null);
    const ev = eventDoc && eventDoc.data;
    if (!ev) {
      await transaction.commit();
      return;
    }

    const now = Date.now();
    const patch: any = {
      enrolledCount: _.inc(-1),
      updatedAt: now,
    };
    if (ev.status === EventStatus.FULL) {
      patch.status = EventStatus.OPEN;
    }
    await transaction
      .collection(Collections.EVENTS)
      .doc(eventId)
      .update({ data: patch });

    await transaction.commit();
  } catch (e) {
    try {
      await transaction.rollback();
    } catch (_e) {
      /* ignore rollback errors */
    }
    throw e;
  }
}

export async function register(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");
  const name = requireString(data?.name || data?.userName, "name");
  const remark = optionalString(data?.remark);

  const existing = await registrations()
    .where({ eventId, openid, status: RegistrationStatus.REGISTERED })
    .get();
  if (existing.data.length > 0) {
    throw new BizError(ErrorCode.ALREADY_REGISTERED, "您已报名该活动");
  }

  const result = await addRegistration(eventId, {
    openid,
    name,
    remark,
    userName: name,
    userPhone: optionalString(data?.userPhone),
    createdByAdmin: false,
  });

  return success({ eventId, ...result });
}

export async function adminCreate(
  data: any,
  ctx: WxContext
): Promise<ApiResponse> {
  const adminOpenid = await requireOrganizer(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");
  const name = requireString(data?.name || data?.userName, "name");
  const remark = optionalString(data?.remark);

  const result = await addRegistration(eventId, {
    openid: "",
    name,
    remark,
    userName: name,
    userPhone: "",
    createdByAdmin: true,
    createdByOpenid: adminOpenid,
  });

  return success({ eventId, ...result });
}

export async function update(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const id = requireString(data?._id, "_id");
  const name = requireString(data?.name || data?.userName, "name");
  const remark = optionalString(data?.remark);

  const regRes = await registrations()
    .doc(id)
    .get()
    .catch(() => null);
  if (!regRes || !regRes.data) {
    throw new BizError(ErrorCode.NOT_FOUND, "报名记录不存在");
  }

  const organizer = await isOrganizer(openid);
  const reg = regRes.data;
  const ownRecord = reg.openid === openid && !reg.createdByAdmin;
  if (!organizer && !ownRecord) {
    throw new BizError(ErrorCode.FORBIDDEN, "无权修改该报名");
  }
  if (reg.status !== RegistrationStatus.REGISTERED) {
    throw new BizError(ErrorCode.NOT_REGISTERED, "报名记录已取消");
  }

  const patch = {
    name,
    remark,
    userName: name,
    updatedAt: Date.now(),
  };
  await registrations().doc(id).update({ data: patch });
  return success({ _id: id, ...patch });
}

export async function cancel(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");

  const existing = await registrations()
    .where({ eventId, openid, status: RegistrationStatus.REGISTERED })
    .get();
  if (existing.data.length === 0) {
    throw new BizError(ErrorCode.NOT_REGISTERED, "您未报名该活动");
  }

  const reg = existing.data[0];
  const now = Date.now();
  await registrations()
    .doc(reg._id)
    .update({
      data: {
        status: RegistrationStatus.CANCELLED,
        cancelledAt: now,
        updatedAt: now,
      },
    });
  await decrementEventCount(eventId);

  return success({ eventId, _id: reg._id });
}

export async function remove(data: any, ctx: WxContext): Promise<ApiResponse> {
  await requireOrganizer(ctx.openid);
  const id = requireString(data?._id, "_id");

  const regRes = await registrations()
    .doc(id)
    .get()
    .catch(() => null);
  if (!regRes || !regRes.data) {
    throw new BizError(ErrorCode.NOT_FOUND, "报名记录不存在");
  }

  const reg = regRes.data;
  if (reg.status !== RegistrationStatus.REGISTERED) {
    return success({ _id: id, removed: false });
  }

  const now = Date.now();
  await registrations()
    .doc(id)
    .update({
      data: {
        status: RegistrationStatus.CANCELLED,
        cancelledAt: now,
        updatedAt: now,
        removedByAdmin: true,
      },
    });
  await decrementEventCount(reg.eventId);

  return success({ _id: id, removed: true });
}

export async function list(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const organizer = await isOrganizer(openid);
  const eventId = optionalString(data?.eventId);

  const filter: any = { openid, status: RegistrationStatus.REGISTERED };
  if (eventId) filter.eventId = eventId;

  const regs = await registrations()
    .where(filter)
    .orderBy("createdAt", "desc")
    .get();

  const eventIds = Array.from(new Set(regs.data.map((r: any) => r.eventId)));
  const eventsMap: Record<string, any> = {};
  if (eventIds.length > 0) {
    const evRes = await events()
      .where({ _id: _.in(eventIds) })
      .get();
    evRes.data.forEach((e: any) => {
      eventsMap[e._id] = e;
    });
  }

  const listData = regs.data.map((r: any) => ({
    ...normalizeRegistration(r, openid, organizer),
    event: eventsMap[r.eventId] || null,
  }));

  return success({ list: listData, total: listData.length, isOrganizer: organizer });
}

export async function myList(data: any, ctx: WxContext): Promise<ApiResponse> {
  return list(data, ctx);
}

export async function eventRoster(
  data: any,
  ctx: WxContext
): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");
  await getEventOrThrow(eventId);

  const organizer = await isOrganizer(openid);
  const regs = await registrations()
    .where({ eventId, status: RegistrationStatus.REGISTERED })
    .orderBy("createdAt", "asc")
    .get();

  const listData = regs.data.map((r: any) =>
    normalizeRegistration(r, openid, organizer)
  );

  return success({ list: listData, total: listData.length, isOrganizer: organizer });
}
