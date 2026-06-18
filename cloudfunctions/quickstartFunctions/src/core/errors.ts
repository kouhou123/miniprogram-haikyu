// 业务错误码集中定义
export enum ErrorCode {
  SUCCESS = 0,
  PARAM_INVALID = 40001,
  UNAUTHORIZED = 40100,
  FORBIDDEN = 40300,
  NOT_FOUND = 40400,
  EVENT_CLOSED = 40901,
  EVENT_FULL = 40902,
  ALREADY_REGISTERED = 40903,
  NOT_REGISTERED = 40904,
  SYSTEM_ERROR = 50000,
}

// 业务异常：在 handler 中抛出，由 router 统一转成 fail 响应
export class BizError extends Error {
  code: number;

  constructor(code: number, msg: string) {
    super(msg);
    this.code = code;
    this.name = "BizError";
  }
}
