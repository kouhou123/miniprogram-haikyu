"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContext = getContext;
const cloud_1 = require("./cloud");
function getContext() {
    const wx = cloud_1.cloud.getWXContext();
    return {
        openid: wx.OPENID || "",
        appid: wx.APPID || "",
        unionid: wx.UNIONID || "",
    };
}
