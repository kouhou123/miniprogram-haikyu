import { success, ApiResponse } from "../core/response";
import { requireOrganizer } from "../core/auth";
import { db, _ } from "../core/cloud";
import { Collections, EventStatus, RegistrationStatus } from "../db/collections";
import { WxContext } from "../core/context";
import { requireString, requireNumber, optionalString } from "../core/validate";
import { BizError, ErrorCode } from "../core/errors";

const events = () => db.collection(Collections.EVENTS);

async function getEventOrThrow(id: string): Promise<any> {
  const res = await events()
    .doc(id)
    .get()
    .catch(() => null);
  if (!res || !res.data) {
    throw new BizError(ErrorCode.NOT_FOUND, "活动不存在");
  }
  return res.data;
}

// 发布活动（组织者）
export async function create(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = await requireOrganizer(ctx.openid);
  const title = requireString(data?.title, "title");
  const startTime = requireNumber(data?.startTime, "startTime");
  const endTime = requireNumber(data?.endTime, "endTime");
  const capacity = requireNumber(data?.capacity, "capacity");

  if (endTime < startTime) {
    throw new BizError(ErrorCode.PARAM_INVALID, "结束时间不能早于开始时间");
  }
  if (capacity <= 0) {
    throw new BizError(ErrorCode.PARAM_INVALID, "人数上限必须大于 0");
  }

  const now = Date.now();
  const doc = {
    title,
    description: optionalString(data?.description),
    coverImage: optionalString(data?.coverImage),
    location: optionalString(data?.location),
    startTime,
    endTime,
    capacity,
    enrolledCount: 0,
    organizerOpenid: openid,
    status: EventStatus.OPEN,
    createdAt: now,
    updatedAt: now,
  };
  const res = await events().add({ data: doc });
  return success({ _id: res._id, ...doc });
}

// 编辑活动（仅本人发布）
export async function update(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = await requireOrganizer(ctx.openid);
  const id = requireString(data?._id, "_id");
  const cur = await getEventOrThrow(id);
  if (cur.organizerOpenid !== openid) {
    throw new BizError(ErrorCode.FORBIDDEN, "只能编辑自己发布的活动");
  }

  const patch: any = { updatedAt: Date.now() };
  if (data.title !== undefined) patch.title = requireString(data.title, "title");
  if (data.description !== undefined) patch.description = optionalString(data.description);
  if (data.coverImage !== undefined) patch.coverImage = optionalString(data.coverImage);
  if (data.location !== undefined) patch.location = optionalString(data.location);
  if (data.startTime !== undefined) patch.startTime = requireNumber(data.startTime, "startTime");
  if (data.endTime !== undefined) patch.endTime = requireNumber(data.endTime, "endTime");
  if (data.capacity !== undefined) {
    const cap = requireNumber(data.capacity, "capacity");
    if (cap < cur.enrolledCount) {
      throw new BizError(ErrorCode.PARAM_INVALID, "人数上限不能小于已报名人数");
    }
    patch.capacity = cap;
    // 调整名额后重新计算是否已满
    if (cur.status === EventStatus.FULL && cap > cur.enrolledCount) {
      patch.status = EventStatus.OPEN;
    } else if (cur.status === EventStatus.OPEN && cap <= cur.enrolledCount) {
      patch.status = EventStatus.FULL;
    }
  }

  await events().doc(id).update({ data: patch });
  return success({ _id: id, ...patch });
}

// 活动列表（分页，可按状态/我发布的筛选）
export async function list(data: any, ctx: WxContext): Promise<ApiResponse> {
  const page = Math.max(1, Number(data?.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(data?.pageSize) || 20));
  const filter: any = {};
  if (data?.status) {
    filter.status = data.status;
  }
  if (data?.mine && ctx.openid) {
    filter.organizerOpenid = ctx.openid;
  }

  const res = await events()
    .where(filter)
    .orderBy("startTime", "desc")
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return success({ list: res.data, page, pageSize });
}

// 某一天的活动列表（按日历日期查询，附带当前用户是否已报名）
export async function byDate(data: any, ctx: WxContext): Promise<ApiResponse> {
  const dayTs = requireNumber(data?.date, "date");
  const d = new Date(dayTs);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const res = await events()
    .where({ startTime: _.gte(dayStart).and(_.lt(dayEnd)) })
    .orderBy("startTime", "asc")
    .get();

  const list: any[] = res.data || [];

  // 标记当前用户已报名的活动，便于前端展示报名/取消按钮
  if (ctx.openid && list.length > 0) {
    const ids = list.map((e: any) => e._id);
    const regs = await db
      .collection(Collections.REGISTRATIONS)
      .where({
        eventId: _.in(ids),
        openid: ctx.openid,
        status: RegistrationStatus.REGISTERED,
      })
      .get();
    const registeredSet = new Set(regs.data.map((r: any) => r.eventId));
    list.forEach((e: any) => {
      e.registered = registeredSet.has(e._id);
    });
  } else {
    list.forEach((e: any) => {
      e.registered = false;
    });
  }

  return success({ list });
}

// 活动详情，附带当前用户的报名记录
export async function detail(data: any, ctx: WxContext): Promise<ApiResponse> {
  const id = requireString(data?._id, "_id");
  const event = await getEventOrThrow(id);

  let myRegistration: any = null;
  if (ctx.openid) {
    const reg = await db
      .collection(Collections.REGISTRATIONS)
      .where({ eventId: id, openid: ctx.openid, status: "registered" })
      .get();
    myRegistration = reg.data[0] || null;
  }

  return success({ event, myRegistration });
}

// 关闭活动（结束报名）
export async function close(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = await requireOrganizer(ctx.openid);
  const id = requireString(data?._id, "_id");
  const cur = await getEventOrThrow(id);
  if (cur.organizerOpenid !== openid) {
    throw new BizError(ErrorCode.FORBIDDEN, "只能操作自己发布的活动");
  }
  await events()
    .doc(id)
    .update({ data: { status: EventStatus.CLOSED, updatedAt: Date.now() } });
  return success({ _id: id, status: EventStatus.CLOSED });
}

// 取消活动
export async function cancel(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = await requireOrganizer(ctx.openid);
  const id = requireString(data?._id, "_id");
  const cur = await getEventOrThrow(id);
  if (cur.organizerOpenid !== openid) {
    throw new BizError(ErrorCode.FORBIDDEN, "只能操作自己发布的活动");
  }
  await events()
    .doc(id)
    .update({ data: { status: EventStatus.CANCELLED, updatedAt: Date.now() } });
  return success({ _id: id, status: EventStatus.CANCELLED });
}
