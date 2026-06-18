import { success, ApiResponse } from "../core/response";
import { requireLogin } from "../core/auth";
import { db, cloud } from "../core/cloud";
import { Collections } from "../db/collections";
import { WxContext } from "../core/context";
import { requireString } from "../core/validate";
import { BizError, ErrorCode } from "../core/errors";

// 为活动添加照片（仅活动发布者）
export async function add(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const eventId = requireString(data?.eventId, "eventId");
  const fileID = requireString(data?.fileID, "fileID");

  const evRes = await db
    .collection(Collections.EVENTS)
    .doc(eventId)
    .get()
    .catch(() => null);
  if (!evRes || !evRes.data) {
    throw new BizError(ErrorCode.NOT_FOUND, "活动不存在");
  }
  if (evRes.data.organizerOpenid !== openid) {
    throw new BizError(ErrorCode.FORBIDDEN, "只能为自己发布的活动上传照片");
  }

  const now = Date.now();
  const doc = { eventId, fileID, uploaderOpenid: openid, createdAt: now };
  const res = await db.collection(Collections.PHOTOS).add({ data: doc });
  return success({ _id: res._id, ...doc });
}

// 活动照片列表
export async function list(data: any, _ctx: WxContext): Promise<ApiResponse> {
  const eventId = requireString(data?.eventId, "eventId");
  const res = await db
    .collection(Collections.PHOTOS)
    .where({ eventId })
    .orderBy("createdAt", "desc")
    .get();
  return success({ list: res.data });
}

// 删除照片（仅上传者），同时删除云存储文件
export async function remove(data: any, ctx: WxContext): Promise<ApiResponse> {
  const openid = requireLogin(ctx.openid);
  const id = requireString(data?._id, "_id");

  const photoRes = await db
    .collection(Collections.PHOTOS)
    .doc(id)
    .get()
    .catch(() => null);
  if (!photoRes || !photoRes.data) {
    throw new BizError(ErrorCode.NOT_FOUND, "照片不存在");
  }
  if (photoRes.data.uploaderOpenid !== openid) {
    throw new BizError(ErrorCode.FORBIDDEN, "只能删除自己上传的照片");
  }

  try {
    await cloud.deleteFile({ fileList: [photoRes.data.fileID] });
  } catch (e) {
    /* 云存储删除失败不阻断记录删除 */
  }
  await db.collection(Collections.PHOTOS).doc(id).remove();
  return success({ _id: id });
}
