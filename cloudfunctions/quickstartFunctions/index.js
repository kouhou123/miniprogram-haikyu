"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const router_1 = require("./router");
// 云函数入口：只负责把请求交给 router 分发
const main = async (event) => {
    return (0, router_1.dispatch)(event);
};
exports.main = main;
