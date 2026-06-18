"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireString = requireString;
exports.requireNumber = requireNumber;
exports.optionalString = optionalString;
const errors_1 = require("./errors");
// 必填字符串：为空抛参数错误
function requireString(value, name) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new errors_1.BizError(errors_1.ErrorCode.PARAM_INVALID, `参数 ${name} 不能为空`);
    }
    return value.trim();
}
// 必填数字：非数字抛参数错误
function requireNumber(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new errors_1.BizError(errors_1.ErrorCode.PARAM_INVALID, `参数 ${name} 必须为数字`);
    }
    return n;
}
// 可选字符串：缺省返回默认值
function optionalString(value, def = "") {
    return typeof value === "string" ? value.trim() : def;
}
