// pages/index/index.js
const { request } = require("../../utils/request");
const auth = require("../../utils/auth");
const { formatEventTime, statusText, formatDate } = require("../../utils/format");

const DAY = 24 * 60 * 60 * 1000;
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

let activeDateMap = {};

function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateKey(tsOrDate) {
  const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildLabel(ts) {
  return `${formatDate(ts)} 周${WEEK[new Date(ts).getDay()]}`;
}

function makeCalendarFormatter(map) {
  return function formatter(day) {
    if (map[dateKey(day.date)]) {
      day.bottomInfo = "报名";
      day.className = `${day.className || ""} calendar-day-active`;
    }
    return day;
  };
}

Page({
  data: {
    isOrganizer: false,
    showCalendar: false,
    minDate: 0,
    maxDate: 0,
    selectedDate: 0,
    calendarFormatter: makeCalendarFormatter(activeDateMap),
    dateLabel: "",
    dayEvents: [],
    dayLoading: false,
    dayHint: "",
    showRegForm: false,
    submitting: false,
    regEventId: "",
    regEventTitle: "",
    regForm: { name: "", remark: "" },
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
    this.loadActiveDates();
    this.loadDayEvents();
  },

  onPullDownRefresh() {
    this.loadActiveDates();
    this.loadDayEvents(() => wx.stopPullDownRefresh());
  },

  onDisplay() {
    this.setData({ showCalendar: true });
    this.loadActiveDates();
  },

  onCloseCalendar() {
    this.setData({ showCalendar: false });
  },

  onSelectDate(e) {
    const ts = startOfDay(e.detail);
    this.setData({
      showCalendar: false,
      selectedDate: ts,
      dateLabel: buildLabel(ts),
      dayHint: "",
    });
    this.loadDayEvents();
  },

  loadActiveDates() {
    if (!this.data.minDate || !this.data.maxDate) return;

    request(
      "event.activeDates",
      {
        startDate: this.data.minDate,
        endDate: this.data.maxDate + DAY,
      },
      { toast: false }
    )
      .then((data) => {
        const map = {};
        (data.times || []).forEach((t) => {
          map[dateKey(t)] = true;
        });
        activeDateMap = map;
        this.setData({ calendarFormatter: makeCalendarFormatter(activeDateMap) });
      })
      .catch(() => {});
  },

  loadDayEvents(done) {
    const dayStart = this.data.selectedDate;
    this.setData({ dayLoading: true, dayHint: "" });
    request(
      "event.byDate",
      {
        dayStart,
        dayEnd: dayStart + DAY,
      },
      { toast: false }
    )
      .then((data) => {
        const list = (data.list || []).map(this.decorate);
        this.setData({ dayEvents: list, dayLoading: false, dayHint: "" });
      })
      .catch(() => {
        this.setData({ dayEvents: [], dayLoading: false, dayHint: "" });
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

  onCardTap(e) {
    const { id, status, registered } = e.currentTarget.dataset;
    if (registered) {
      wx.showToast({ title: "您已报名该活动", icon: "none" });
      return;
    }
    if (status !== "open") {
      wx.showToast({ title: statusText(status) || "暂不可报名", icon: "none" });
      return;
    }
    this.openRegisterForm(id);
  },

  openRegisterForm(id) {
    const ev = this.data.dayEvents.find((item) => item._id === id) || {};
    const user = auth.getUser() || {};
    this.setData({
      showRegForm: true,
      regEventId: id,
      regEventTitle: ev.title || "",
      regForm: { name: user.nickName || "", remark: "" },
    });
  },

  closeRegForm() {
    this.setData({
      showRegForm: false,
      regEventId: "",
      regEventTitle: "",
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

    this.setData({ submitting: true });
    request(
      "registration.register",
      { eventId: this.data.regEventId, name, remark },
      { loading: true, loadingText: "报名中..." }
    )
      .then(() => {
        wx.showToast({ title: "报名成功" });
        this.closeRegForm();
        this.loadActiveDates();
        this.loadDayEvents();
      })
      .catch(() => {})
      .finally(() => this.setData({ submitting: false }));
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
            this.loadActiveDates();
            this.loadDayEvents();
          })
          .catch(() => {});
      },
    });
  },

  onDeleteEvent(e) {
    const { id, title } = e.currentTarget.dataset;
    wx.showModal({
      title: "删除活动",
      content: `确定要删除「${title}」吗？删除后报名记录将一并清除，且不可恢复。`,
      confirmColor: "#ee0a24",
      success: (res) => {
        if (!res.confirm) return;
        request(
          "event.remove",
          { _id: id },
          { loading: true, loadingText: "删除中..." }
        )
          .then(() => {
            wx.showToast({ title: "已删除" });
            this.loadActiveDates();
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
