"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.fail = fail;
function success(data = null, msg = "ok") {
    return { code: 0, msg, data };
}
function fail(code, msg) {
    return { code, msg, data: null };
}
