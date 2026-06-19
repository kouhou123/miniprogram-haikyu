"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatch = dispatch;
const response_1 = require("./core/response");
const errors_1 = require("./core/errors");
const context_1 = require("./core/context");
const userModule = __importStar(require("./modules/user"));
const eventModule = __importStar(require("./modules/event"));
const registrationModule = __importStar(require("./modules/registration"));
const photoModule = __importStar(require("./modules/photo"));
// 路由表：type -> handler，命名空间风格 模块.动作
const routes = {
    // 用户
    "user.login": userModule.login,
    "user.updateProfile": userModule.updateProfile,
    // 活动
    "event.create": eventModule.create,
    "event.update": eventModule.update,
    "event.list": eventModule.list,
    "event.activeDates": eventModule.activeDates,
    "event.byDate": eventModule.byDate,
    "event.detail": eventModule.detail,
    "event.close": eventModule.close,
    "event.cancel": eventModule.cancel,
    // 报名
    "registration.register": registrationModule.register,
    "registration.adminCreate": registrationModule.adminCreate,
    "registration.cancel": registrationModule.cancel,
    "registration.update": registrationModule.update,
    "registration.remove": registrationModule.remove,
    "registration.list": registrationModule.list,
    "registration.myList": registrationModule.myList,
    "registration.eventRoster": registrationModule.eventRoster,
    // 照片
    "photo.add": photoModule.add,
    "photo.list": photoModule.list,
    "photo.delete": photoModule.remove,
};
// 统一分发 + 异常处理
async function dispatch(event) {
    const { type, data } = event || {};
    const handler = routes[type];
    if (!handler) {
        return (0, response_1.fail)(errors_1.ErrorCode.NOT_FOUND, `未知的接口类型: ${type}`);
    }
    const ctx = (0, context_1.getContext)();
    try {
        return await handler(data || {}, ctx);
    }
    catch (e) {
        if (e instanceof errors_1.BizError) {
            return (0, response_1.fail)(e.code, e.message);
        }
        console.error(`[${type}] 系统错误`, e);
        return (0, response_1.fail)(errors_1.ErrorCode.SYSTEM_ERROR, "系统错误，请稍后重试");
    }
}
