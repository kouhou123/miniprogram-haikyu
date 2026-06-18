// pages/myRegistrations/index.js
const { request } = require("../../utils/request");
const { formatEventTime, statusText } = require("../../utils/format");

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList(() => wx.stopPullDownRefresh());
  },

  loadList(done) {
    this.setData({ loading: true });
    request("registration.myList", { status: "registered" }, { toast: false })
      .then((data) => {
        const list = (data.list || [])
          .filter((r) => r.event)
          .map((r) => ({
            _id: r._id,
            eventId: r.eventId,
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

  cancelRegister(e) {
    const eventId = e.currentTarget.dataset.id;
    wx.showModal({
      title: "取消报名",
      content: "确定要取消报名吗？",
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
});
