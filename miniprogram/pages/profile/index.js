// pages/profile/index.js 个人中心
const auth = require("../../utils/auth");

Page({
  data: {
    user: null,
    isOrganizer: false,
    editing: false,
    form: { nickName: "", avatarUrl: "", motto: "" },
  },

  onShow() {
    this.refreshUser();
  },

  refreshUser() {
    // 确保已登录拿到最新用户态
    auth
      .login()
      .then((res) => {
        this.setData({ user: res.user, isOrganizer: res.isOrganizer });
      })
      .catch(() => {
        this.setData({ user: auth.getUser(), isOrganizer: auth.isOrganizer() });
      });
  },

  startEdit() {
    const u = this.data.user || {};
    this.setData({
      editing: true,
      form: {
        nickName: u.nickName || "",
        avatarUrl: u.avatarUrl || "",
        motto: u.motto || "",
      },
    });
  },

  cancelEdit() {
    this.setData({ editing: false });
  },

  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl;
    wx.showLoading({ title: "上传中...", mask: true });
    wx.cloud
      .uploadFile({
        cloudPath: `avatars/${Date.now()}.png`,
        filePath: tempPath,
      })
      .then((res) => {
        this.setData({ "form.avatarUrl": res.fileID });
      })
      .catch(() => {
        wx.showToast({ title: "头像上传失败", icon: "none" });
      })
      .finally(() => wx.hideLoading());
  },

  onNickInput(e) {
    this.setData({ "form.nickName": e.detail.value });
  },

  onMottoInput(e) {
    this.setData({ "form.motto": e.detail.value });
  },

  saveProfile() {
    const { nickName, avatarUrl, motto } = this.data.form;
    if (!nickName.trim()) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }
    auth
      .updateProfile({ nickName: nickName.trim(), avatarUrl, motto: motto.trim() })
      .then(() => {
        wx.showToast({ title: "已保存" });
        this.setData({ editing: false });
        this.refreshUser();
      })
      .catch(() => {});
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/eventEdit/index" });
  },
});
