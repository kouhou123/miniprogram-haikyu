// pages/eventDetail/index.js
const { request } = require("../../utils/request");
const auth = require("../../utils/auth");
const { formatEventTime, statusText } = require("../../utils/format");

Page({
  data: {
    eventId: "",
    event: null,
    myRegistration: null,
    photos: [],
    roster: [],
    showRoster: false,
    isOwner: false,
    submitting: false,
    timeText: "",
    statusTextStr: "",
    remaining: 0,
  },

  onLoad(options) {
    this.setData({ eventId: options.id });
  },

  onShow() {
    if (this.data.eventId) {
      this.loadDetail();
      this.loadPhotos();
    }
  },

  loadDetail() {
    request("event.detail", { _id: this.data.eventId })
      .then((data) => {
        const ev = data.event;
        const user = auth.getUser();
        this.setData({
          event: ev,
          myRegistration: data.myRegistration,
          isOwner: !!user && ev.organizerOpenid === user.openid,
          timeText: formatEventTime(ev.startTime, ev.endTime),
          statusTextStr: statusText(ev.status),
          remaining: Math.max(0, (ev.capacity || 0) - (ev.enrolledCount || 0)),
        });
        wx.setNavigationBarTitle({ title: ev.title || "活动详情" });
      })
      .catch(() => {});
  },

  loadPhotos() {
    request("photo.list", { eventId: this.data.eventId }, { toast: false })
      .then((data) => this.setData({ photos: data.list || [] }))
      .catch(() => {});
  },

  register() {
    if (this.data.submitting) return;
    const user = auth.getUser() || {};
    this.setData({ submitting: true });
    request(
      "registration.register",
      {
        eventId: this.data.eventId,
        userName: user.nickName || "",
        userPhone: user.phone || "",
      },
      { loading: true, loadingText: "报名中..." }
    )
      .then(() => {
        wx.showToast({ title: "报名成功" });
        this.loadDetail();
      })
      .catch(() => {})
      .finally(() => this.setData({ submitting: false }));
  },

  cancelRegister() {
    wx.showModal({
      title: "取消报名",
      content: "确定要取消报名吗？",
      success: (res) => {
        if (!res.confirm) return;
        request(
          "registration.cancel",
          { eventId: this.data.eventId },
          { loading: true, loadingText: "处理中..." }
        )
          .then(() => {
            wx.showToast({ title: "已取消报名" });
            this.loadDetail();
          })
          .catch(() => {});
      },
    });
  },

  goEdit() {
    wx.navigateTo({
      url: `/pages/eventEdit/index?id=${this.data.eventId}`,
    });
  },

  toggleRoster() {
    if (this.data.showRoster) {
      this.setData({ showRoster: false });
      return;
    }
    request("registration.eventRoster", { eventId: this.data.eventId })
      .then((data) => {
        this.setData({ roster: data.list || [], showRoster: true });
      })
      .catch(() => {});
  },

  closeEvent() {
    this.organizerAction("event.close", "关闭报名", "关闭后用户将无法继续报名，确定吗？");
  },

  cancelEvent() {
    this.organizerAction("event.cancel", "取消活动", "取消活动后将不可恢复，确定吗？");
  },

  organizerAction(type, title, content) {
    wx.showModal({
      title,
      content,
      success: (res) => {
        if (!res.confirm) return;
        request(type, { _id: this.data.eventId }, { loading: true })
          .then(() => {
            wx.showToast({ title: "操作成功" });
            this.loadDetail();
          })
          .catch(() => {});
      },
    });
  },

  uploadPhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: "上传中...", mask: true });
        wx.cloud
          .uploadFile({
            cloudPath: `events/${this.data.eventId}/${Date.now()}.png`,
            filePath,
          })
          .then((upRes) =>
            request("photo.add", {
              eventId: this.data.eventId,
              fileID: upRes.fileID,
            })
          )
          .then(() => {
            wx.showToast({ title: "上传成功" });
            this.loadPhotos();
          })
          .catch(() => {
            wx.showToast({ title: "上传失败", icon: "none" });
          })
          .finally(() => wx.hideLoading());
      },
    });
  },

  deletePhoto(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除照片",
      content: "确定删除这张照片吗？",
      success: (res) => {
        if (!res.confirm) return;
        request("photo.delete", { _id: id }, { loading: true })
          .then(() => this.loadPhotos())
          .catch(() => {});
      },
    });
  },

  previewPhoto(e) {
    const current = e.currentTarget.dataset.src;
    const urls = this.data.photos.map((p) => p.fileID);
    wx.previewImage({ current, urls });
  },
});
