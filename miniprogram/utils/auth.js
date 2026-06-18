// 登录与用户态管理
const { request } = require("./request");

const STORAGE_USER = "userInfo";
const STORAGE_ORGANIZER = "isOrganizer";

function syncToApp(user, isOrganizer) {
  const app = getApp();
  if (app) {
    app.globalData.userInfo = user;
    app.globalData.isOrganizer = isOrganizer;
  }
}

/**
 * 登录：首次会自动建档。可传入 profile { nickName, avatarUrl } 同步资料
 * @returns {Promise<{user, isOrganizer}>}
 */
function login(profile = {}) {
  return request("user.login", profile, { toast: false }).then((data) => {
    wx.setStorageSync(STORAGE_USER, data.user);
    wx.setStorageSync(STORAGE_ORGANIZER, data.isOrganizer);
    syncToApp(data.user, data.isOrganizer);
    return data;
  });
}

// 更新资料
function updateProfile(profile) {
  return request("user.updateProfile", profile).then((res) => {
    const user = Object.assign({}, getUser(), profile);
    wx.setStorageSync(STORAGE_USER, user);
    syncToApp(user, isOrganizer());
    return res;
  });
}

function getUser() {
  const app = getApp();
  if (app && app.globalData.userInfo) {
    return app.globalData.userInfo;
  }
  return wx.getStorageSync(STORAGE_USER) || null;
}

function isOrganizer() {
  const app = getApp();
  if (app && typeof app.globalData.isOrganizer === "boolean") {
    return app.globalData.isOrganizer;
  }
  return !!wx.getStorageSync(STORAGE_ORGANIZER);
}

module.exports = { login, updateProfile, getUser, isOrganizer };
