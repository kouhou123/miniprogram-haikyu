// app.js
App({
  globalData: {
    // ⚠️ 请在此填入你的云开发环境 ID
    // 环境 ID 可在微信开发者工具右上角「云开发」控制台中获取
    env: "cloud1-1gdyk1k2c212e96f",
    userInfo: null,
    isOrganizer: false,
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }
    if (!this.globalData.env) {
      console.warn(
        "[云开发] 尚未配置环境 ID，请在 miniprogram/app.js 的 globalData.env 中填写"
      );
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
  },
});
