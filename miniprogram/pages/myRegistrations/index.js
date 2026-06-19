// pages/myRegistrations/index.js
const { request } = require("../../utils/request");
const { formatEventTime, statusText } = require("../../utils/format");

function registrationName(reg) {
  return (reg && (reg.name || reg.userName)) || "";
}

Page({
  data: {
    list: [],
    loading: true,
    showForm: false,
    editingRegistrationId: "",
    editingEventId: "",
    form: { name: "", remark: "" },
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList(() => wx.stopPullDownRefresh());
  },

  loadList(done) {
    this.setData({ loading: true });
    request("registration.list", {}, { toast: false })
      .then((data) => {
        const list = (data.list || [])
          .filter((r) => r.event)
          .map((r) => ({
            _id: r._id,
            eventId: r.eventId,
            name: registrationName(r),
            remark: r.remark || "",
            canEdit: !!r.canEdit,
            canCancel: !!r.canCancel,
            canRemove: !!r.canRemove,
            createdByAdmin: !!r.createdByAdmin,
            event: Object.assign({}, r.event, {
              timeText: formatEventTime(r.event.startTime, r.event.endTime),
              statusText: statusText(r.event.status),
            }),
          }));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ loading: false }))
      .finally(() => {
        if (done) done();
      });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/eventDetail/index?id=${id}` });
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((reg) => reg._id === id);
    if (!item) return;
    this.setData({
      showForm: true,
      editingRegistrationId: id,
      editingEventId: item.eventId,
      form: {
        name: item.name || "",
        remark: item.remark || "",
      },
    });
  },

  closeForm() {
    this.setData({
      showForm: false,
      editingRegistrationId: "",
      editingEventId: "",
      form: { name: "", remark: "" },
    });
  },

  onNameInput(e) {
    this.setData({ "form.name": e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ "form.remark": e.detail.value });
  },

  noop() {},

  saveRegistration() {
    const name = this.data.form.name.trim();
    const remark = this.data.form.remark.trim();
    if (!name) {
      wx.showToast({ title: "请输入名字", icon: "none" });
      return;
    }

    request(
      "registration.update",
      { _id: this.data.editingRegistrationId, name, remark },
      { loading: true, loadingText: "保存中..." }
    )
      .then(() => {
        wx.showToast({ title: "已保存" });
        this.closeForm();
        this.loadList();
      })
      .catch(() => {});
  },

  cancelRegister(e) {
    const eventId = e.currentTarget.dataset.eventId;
    wx.showModal({
      title: "取消报名",
      content: "确定要取消自己的报名吗？",
      success: (res) => {
        if (!res.confirm) return;
        request("registration.cancel", { eventId }, { loading: true })
          .then(() => {
            wx.showToast({ title: "已取消报名" });
            this.loadList();
          })
          .catch(() => {});
      },
    });
  },

  removeRegistration(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除报名",
      content: "确定要删除这条报名记录吗？",
      success: (res) => {
        if (!res.confirm) return;
        request("registration.remove", { _id: id }, { loading: true })
          .then(() => {
            wx.showToast({ title: "已删除" });
            this.loadList();
          })
          .catch(() => {});
      },
    });
  },
});
