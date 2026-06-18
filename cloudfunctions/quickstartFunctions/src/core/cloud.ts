// 云开发 SDK 初始化与公共导出
// 所有需要访问数据库 / 存储 / 微信上下文的模块都从这里取实例
const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

export const db = cloud.database();
// 数据库指令（_.inc / _.in 等）
export const _ = db.command;

export { cloud };
