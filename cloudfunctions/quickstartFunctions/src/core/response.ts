// 统一接口返回结构：code=0 表示成功，非 0 为业务错误码
export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T | null;
}

export function success<T>(data: T = null as unknown as T, msg = "ok"): ApiResponse<T> {
  return { code: 0, msg, data };
}

export function fail(code: number, msg: string): ApiResponse<null> {
  return { code, msg, data: null };
}
