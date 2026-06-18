"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BizError = exports.ErrorCode = void 0;
// 业务错误码集中定义
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["SUCCESS"] = 0] = "SUCCESS";
    ErrorCode[ErrorCode["PARAM_INVALID"] = 40001] = "PARAM_INVALID";
    ErrorCode[ErrorCode["UNAUTHORIZED"] = 40100] = "UNAUTHORIZED";
    ErrorCode[ErrorCode["FORBIDDEN"] = 40300] = "FORBIDDEN";
    ErrorCode[ErrorCode["NOT_FOUND"] = 40400] = "NOT_FOUND";
    ErrorCode[ErrorCode["EVENT_CLOSED"] = 40901] = "EVENT_CLOSED";
    ErrorCode[ErrorCode["EVENT_FULL"] = 40902] = "EVENT_FULL";
    ErrorCode[ErrorCode["ALREADY_REGISTERED"] = 40903] = "ALREADY_REGISTERED";
    ErrorCode[ErrorCode["NOT_REGISTERED"] = 40904] = "NOT_REGISTERED";
    ErrorCode[ErrorCode["SYSTEM_ERROR"] = 50000] = "SYSTEM_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// 业务异常：在 handler 中抛出，由 router 统一转成 fail 响应
class BizError extends Error {
    constructor(code, msg) {
        super(msg);
        this.code = code;
        this.name = "BizError";
    }
}
exports.BizError = BizError;
