// pages/index/index.js 活动日历
const { request } = require("../../utils/request");
const auth = require("../../utils/auth");
const { formatEventTime, statusText, formatDate } = require("../../utils/format");

const DAY = 24 * 60 * 60 * 1000;
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

// 取某个时间戳所在自然日的 0 点
function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function buildLabel(ts) {
  return `${formatDate(ts)} 周${WEEK[new Date(ts).getDay()]}`;
}

Page({
  data: {
    isOrganizer: false,
    showCalendar: false,
    minDate: 0,
    maxDate: 0,
    selectedDate: 0,
    dateLabel: "",
    dayEvents: [],
    dayLoading: false,
  },

  onLoad() {
    const today = startOfDay(Date.now());
    this.setData({
      minDate: today - 365 * DAY,
      maxDate: today + 365 * DAY,
      selectedDate: today,
      dateLabel: buildLabel(today),
    });

    auth
      .login()
      .then((res) => this.setData({ isOrganizer: res.isOrganizer }))
      .catch(() => {});
  },

  onShow() {
    this.setData({ isOrganizer: auth.isOrganizer() });
    this.loadDayEvents();
  },

  onPullDownRefresh() {
    this.loadDayEvents(() => wx.stopPullDownRefresh());
  },

  // 打开日历
  onDisplay() {
    this.setData({ showCalendar: true });
  },

  onCloseCalendar() {
    this.setData({ showCalendar: false });
  },

  // 选定日期：show-confirm 为 false 时点击日期即触发
  onConfirmDate(e) {
    const ts = startOfDay(e.detail);
    this.setData({
      showCalendar: false,
      selectedDate: ts,
      dateLabel: buildLabel(ts),
    });
    this.loadDayEvents();
  },

  loadDayEvents(done) {
    this.setData({ dayLoading: true });
    request("event.byDate", { date: this.data.selectedDate }, { toast: false })
      .then((data) => {
        const list = (data.list || []).map(this.decorate);
        this.setData({ dayEvents: list, dayLoading: false });
      })
      .catch(() => {
        this.setData({ dayEvents: [], dayLoading: false });
      })
      .finally(() => {
        if (done) done();
      });
  },

  decorate(ev) {
    return Object.assign({}, ev, {
      timeText: formatEventTime(ev.startTime, ev.endTime),
      statusText: statusText(ev.status),
      remaining: Math.max(0, (ev.capacity || 0) - (ev.enrolledCount || 0)),
    });
  },

  onRegister(e) {
    const id = e.currentTarget.dataset.id;
    const user = auth.getUser() || {};
    request(
      "registration.register",
      {
        eventId: id,
        userName: user.nickName || "",
        userPhone: user.phone || "",
      },
      { loading: true, loadingText: "报名中..." }
    )
      .then(() => {
        wx.showToast({ title: "报名成功" });
        this.loadDayEvents();
      })
      .catch(() => {});
  },

  onCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "取消报名",
      content: "确定要取消报名吗？",
      success: (res) => {
        if (!res.confirm) return;
        request(
          "registration.cancel",
          { eventId: id },
          { loading: true, loadingText: "处理中..." }
        )
          .then(() => {
            wx.showToast({ title: "已取消报名" });
            this.loadDayEvents();
          })
          .catch(() => {});
      },
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/eventDetail/index?id=${id}` });
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/eventEdit/index" });
  },
});
