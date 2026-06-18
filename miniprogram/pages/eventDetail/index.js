// pages/eventDetail/index.js
const { request } = require("../../utils/request");
const auth = require("../../utils/auth");
const { formatEventTime, statusText } = require("../../utils/format");

function registrationName(reg) {
  return (reg && (reg.name || reg.userName)) || "";
}

Page({
  data: {
    eventId: "",
    event: null,
    myRegistration: null,
    photos: [],
    roster: [],
    isOwner: false,
    isOrganizer: false,
    submitting: false,
    timeText: "",
    statusTextStr: "",
    remaining: 0,
    showRegForm: false,
    regMode: "register",
    editingRegistrationId: "",
    regForm: { name: "", remark: "" },
  },

  onLoad(options) {
    this.setData({ eventId: options.id });
  },

  onShow() {
    if (this.data.eventId) {
      auth
        .login()
        .catch(() => null)
        .finally(() => {
          this.loadDetail();
          this.loadPhotos();
          this.loadRoster();
        });
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
          isOrganizer: auth.isOrganizer(),
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

  loadRoster() {
    request("registration.eventRoster", { eventId: this.data.eventId }, { toast: false })
      .then((data) => {
        this.setData({
          roster: data.list || [],
          isOrganizer: data.isOrganizer || auth.isOrganizer(),
        });
      })
      .catch(() => {});
  },

  openRegisterForm() {
    const user = auth.getUser() || {};
    this.setData({
      showRegForm: true,
      regMode: "register",
      editingRegistrationId: "",
      regForm: {
        name: user.nickName || "",
        remark: "",
      },
    });
  },

  openAdminCreateForm() {
    this.setData({
      showRegForm: true,
      regMode: "adminCreate",
      editingRegistrationId: "",
      regForm: { name: "", remark: "" },
    });
  },

  openEditMyForm() {
    const reg = this.data.myRegistration || {};
    this.setData({
      showRegForm: true,
      regMode: "edit",
      editingRegistrationId: reg._id || "",
      regForm: {
        name: registrationName(reg),
        remark: reg.remark || "",
      },
    });
  },

  editRosterItem(e) {
    const id = e.currentTarget.dataset.id;
    const reg = this.data.roster.find((item) => item._id === id);
    if (!reg) return;
    this.setData({
      showRegForm: true,
      regMode: "edit",
      editingRegistrationId: id,
      regForm: {
        name: registrationName(reg),
        remark: reg.remark || "",
      },
    });
  },

  closeRegForm() {
    this.setData({
      showRegForm: false,
      editingRegistrationId: "",
      regForm: { name: "", remark: "" },
    });
  },

  onRegNameInput(e) {
    this.setData({ "regForm.name": e.detail.value });
  },

  onRegRemarkInput(e) {
    this.setData({ "regForm.remark": e.detail.value });
  },

  noop() {},

  submitRegistration() {
    if (this.data.submitting) return;
    const name = this.data.regForm.name.trim();
    const remark = this.data.regForm.remark.trim();
    if (!name) {
      wx.showToast({ title: "请输入名字", icon: "none" });
      return;
    }

    const mode = this.data.regMode;
    const type =
      mode === "adminCreate"
        ? "registration.adminCreate"
        : mode === "edit"
        ? "registration.update"
        : "registration.register";
    const data =
      mode === "edit"
        ? { _id: this.data.editingRegistrationId, name, remark }
        : { eventId: this.data.eventId, name, remark };

    this.setData({ submitting: true });
    request(type, data, { loading: true, loadingText: "保存中..." })
      .then(() => {
        wx.showToast({ title: mode === "register" ? "报名成功" : "已保存" });
        this.closeRegForm();
        this.loadDetail();
        this.loadRoster();
      })
      .catch(() => {})
      .finally(() => this.setData({ submitting: false }));
  },

  cancelRegister() {
    wx.showModal({
      title: "取消报名",
      content: "确定要取消自己的报名吗？",
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
            this.loadRoster();
          })
          .catch(() => {});
      },
    });
  },

  removeRosterItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除报名",
      content: "确定要删除这条报名记录吗？",
      success: (res) => {
        if (!res.confirm) return;
        request("registration.remove", { _id: id }, { loading: true })
          .then(() => {
            wx.showToast({ title: "已删除" });
            this.loadDetail();
            this.loadRoster();
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

  closeEvent() {
    this.organizerAction("event.close", "关闭报名", "关闭后用户将不能继续报名，确定吗？");
  },

  cancelEvent() {
    this.organizerAction("event.cancel", "取消活动", "取消活动后不可恢复，确定吗？");
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
      content: "确定要删除这张照片吗？",
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
