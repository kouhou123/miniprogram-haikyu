import { cloud } from "./cloud";

// 微信调用上下文
export interface WxContext {
  openid: string;
  appid: string;
  unionid: string;
}

export function getContext(): WxContext {
  const wx = cloud.getWXContext();
  return {
    openid: wx.OPENID || "",
    appid: wx.APPID || "",
    unionid: wx.UNIONID || "",
  };
}
