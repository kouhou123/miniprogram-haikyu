import { success, ApiResponse } from "../core/response";
import { requireLogin } from "../core/auth";
import { db, _ } from "../core/cloud";
import {
  Collections,
  EventStatus,
  RegistrationStatus,
} from "../db/collections";
import { WxContext } from "../core/context";
import { requireString, optionalString } from "../core/validate";
import { BizError, ErrorCode } from "../core/errors";

// 报名（事务保证不超额）
export async function register(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");
  const userName = optionalString(data?.userName);
  const userPhone = optionalString(data?.userPhone);

  // 是否已有有效报名
  const existing = await db
    .collection(Collections.REGISTRATIONS)
    .where({ eventId, openid, status: RegistrationStatus.REGISTERED })
    .get();
  if (existing.data.length > 0) {
    throw new BizError(ErrorCode.ALREADY_REGISTERED, "您已报名该活动");
  }

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
    if (ev.status !== EventStatus.OPEN) {
      await transaction.rollback();
      throw new BizError(ErrorCode.EVENT_CLOSED, "活动已结束或已关闭报名");
    }
    if (ev.enrolledCount >= ev.capacity) {
      await transaction.rollback();
      throw new BizError(ErrorCode.EVENT_FULL, "名额已满");
    }

    const now = Date.now();
    await transaction.collection(Collections.REGISTRATIONS).add({
      data: {
        eventId,
        openid,
        userName,
        userPhone,
        status: RegistrationStatus.REGISTERED,
        createdAt: now,
        cancelledAt: 0,
      },
    });

    const newCount = ev.enrolledCount + 1;
    const patch: any = { enrolledCount: _.inc(1), updatedAt: now };
    if (newCount >= ev.capacity) {
      patch.status = EventStatus.FULL;
    }
    await transaction
      .collection(Collections.EVENTS)
      .doc(eventId)
      .update({ data: patch });

    await transaction.commit();
    return success({ eventId, enrolledCount: newCount });
  } catch (e) {
    if (e instanceof BizError) throw e;
    try {
      await transaction.rollback();
    } catch (_e) {
      /* 忽略回滚异常 */
    }
    throw e;
  }
}

// 取消报名（事务回退名额）
export async function cancel(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");

  const existing = await db
    .collection(Collections.REGISTRATIONS)
    .where({ eventId, openid, status: RegistrationStatus.REGISTERED })
    .get();
  if (existing.data.length === 0) {
    throw new BizError(ErrorCode.NOT_REGISTERED, "您未报名该活动");
  }
  const regId = existing.data[0]._id;

  const transaction = await db.startTransaction();
  try {
    const eventDoc = await transaction
      .collection(Collections.EVENTS)
      .doc(eventId)
      .get();
    const ev = eventDoc.data;
    const now = Date.now();

    await transaction
      .collection(Collections.REGISTRATIONS)
      .doc(regId)
      .update({
        data: { status: RegistrationStatus.CANCELLED, cancelledAt: now },
      });

    if (ev) {
      const patch: any = { enrolledCount: _.inc(-1), updatedAt: now };
      // 取消后若原为已满则重新开放
      if (ev.status === EventStatus.FULL) {
        patch.status = EventStatus.OPEN;
      }
      await transaction
        .collection(Collections.EVENTS)
        .doc(eventId)
        .update({ data: patch });
    }

    await transaction.commit();
    return success({ eventId });
  } catch (e) {
    try {
      await transaction.rollback();
    } catch (_e) {
      /* 忽略回滚异常 */
    }
    throw e;
  }
}

// 我的报名列表（附带活动信息）
export async function myList(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const status = data?.status || RegistrationStatus.REGISTERED;

  const regs = await db
    .collection(Collections.REGISTRATIONS)
    .where({ openid, status })
    .orderBy("createdAt", "desc")
    .get();

  const eventIds = regs.data.map((r: any) => r.eventId);
  const eventsMap: Record<string, any> = {};
  if (eventIds.length > 0) {
    const evRes = await db
      .collection(Collections.EVENTS)
      .where({ _id: _.in(eventIds) })
      .get();
    evRes.data.forEach((e: any) => {
      eventsMap[e._id] = e;
    });
  }

  const listData = regs.data.map((r: any) => ({
    ...r,
    event: eventsMap[r.eventId] || null,
  }));

  return success({ list: listData });
}

// 活动报名名单（仅活动发布者可看）
export async function eventRoster(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");

  const evRes = await db
    .collection(Collections.EVENTS)
    .doc(eventId)
    .get()
    .catch(() => null);
  if (!evRes || !evRes.data) {
    throw new BizError(ErrorCode.NOT_FOUND, "活动不存在");
  }
  if (evRes.data.organizerOpenid !== openid) {
    throw new BizError(ErrorCode.FORBIDDEN, "只能查看自己发布的活动报名名单");
  }

  const regs = await db
    .collection(Collections.REGISTRATIONS)
    .where({ eventId, status: RegistrationStatus.REGISTERED })
    .orderBy("createdAt", "asc")
    .get();

  return success({ list: regs.data, total: regs.data.length });
}
