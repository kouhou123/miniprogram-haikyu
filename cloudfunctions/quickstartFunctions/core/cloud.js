"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloud = exports._ = exports.db = void 0;
// 云开发 SDK 初始化与公共导出
// 所有需要访问数据库 / 存储 / 微信上下文的模块都从这里取实例
const cloud = require("wx-server-sdk");
exports.cloud = cloud;
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV,
});
exports.db = cloud.database();
// 数据库指令（_.inc / _.in 等）
exports._ = exports.db.command;
