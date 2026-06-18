import { BizError, ErrorCode } from "./errors";

// 必填字符串：为空抛参数错误
export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BizError(ErrorCode.PARAM_INVALID, `参数 ${name} 不能为空`);
  }
  return value.trim();
}

// 必填数字：非数字抛参数错误
export function requireNumber(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new BizError(ErrorCode.PARAM_INVALID, `参数 ${name} 必须为数字`);
  }
  return n;
}

// 可选字符串：缺省返回默认值
export function optionalString(value: unknown, def = ""): string {
  return typeof value === "string" ? value.trim() : def;
}
