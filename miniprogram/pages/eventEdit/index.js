// pages/eventEdit/index.js 发布/编辑活动
const { request } = require("../../utils/request");
const { formatDate, formatTime } = require("../../utils/format");

function toTimestamp(date, time) {
  if (!date || !time) return 0;
  return new Date(`${date.replace(/-/g, "/")} ${time}:00`).getTime();
}

function buildTitle(form) {
  const note = (form.description || "").trim();
  if (note) return note.split("\n")[0].slice(0, 30);
  return `活动 ${form.date}`;
}

Page({
  data: {
    isEdit: false,
    eventId: "",
    submitting: false,
    showCalendar: false,
    calendarDefaultDate: null,
    form: {
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      capacity: "",
      description: "",
    },
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, eventId: options.id });
      wx.setNavigationBarTitle({ title: "编辑活动" });
      this.loadEvent(options.id);
    } else {
      wx.setNavigationBarTitle({ title: "发布活动" });
      // 新建：进入即弹出日历选择日期
      this.setData({
        calendarDefaultDate: Date.now(),
        showCalendar: true,
      });
    }
  },

  loadEvent(id) {
    request("event.detail", { _id: id })
      .then((data) => {
        const ev = data.event;
        this.setData({
          form: {
            date: formatDate(ev.startTime),
            startTime: formatTime(ev.startTime),
            endTime: formatTime(ev.endTime),
            location: ev.location || "",
            capacity: String(ev.capacity || ""),
            description: ev.description || "",
          },
        });
      })
      .catch(() => {});
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onTimeChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  // 加载指定月份的活动日期，用于日历高亮
  loadMonthEvents(defaultDateTs) {
    const d = new Date(defaultDateTs || Date.now());
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    // 拉取一定量的活动然后在前端过滤（简化实现）
    request("event.list", { page: 1, pageSize: 100 }, { toast: false })
      .then((data) => {
        const list = data.list || [];
        const map = {};
        list.forEach((ev) => {
          if (ev && ev.startTime >= monthStart && ev.startTime < monthEnd) {
            map[formatDate(ev.startTime)] = true;
          }
        });
        this.setData({ eventDaysMap: map });
      })
      .catch(() => {
        this.setData({ eventDaysMap: {} });
      });
  },

  // calendar formatter：为有活动的日期添加 className 用于样式高亮
  formatter(config) {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    const map = (page && page.data && page.data.eventDaysMap) || {};
    const raw = config && config.date ? config.date : config;
    const ts = raw instanceof Date ? raw.getTime() : raw;
    const key = formatDate(ts);
    if (map[key]) {
      config.className = (config.className ? config.className + " " : "") + "has-event";
    }
    return config;
  },

  openCalendar() {
    const cur = this.data.form.date;
    const def = cur ? new Date(cur.replace(/-/g, "/")).getTime() : Date.now();
    // 先加载当月有活动的日期以高亮显示
    this.loadMonthEvents(def);
    this.setData({
      calendarDefaultDate: def,
      showCalendar: true,
    });
  },

  onCalendarConfirm(e) {
    // 支持 van-calendar 返回的两种形式：
    // - e.detail 为时间戳（number）
    // - e.detail.date 为 Date 对象
    const payload = e.detail;
    const raw = payload && payload.date ? payload.date : payload;
    const dt = new Date(raw);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    this.setData({
      "form.date": `${y}-${m}-${d}`,
      showCalendar: false,
    });
  },

  onCalendarClose() {
    this.setData({ showCalendar: false });
  },

  validate() {
    const f = this.data.form;
    if (!f.date) return "请选择活动日期";
    if (!f.startTime) return "请选择开始时间";
    if (!f.endTime) return "请选择结束时间";
    const start = toTimestamp(f.date, f.startTime);
    const end = toTimestamp(f.date, f.endTime);
    if (end < start) return "结束时间不能早于开始时间";
    const cap = Number(f.capacity);
    if (!cap || cap <= 0) return "请输入有效的人数上限";
    return "";
  },

  submit() {
    if (this.data.submitting) return;
    const err = this.validate();
    if (err) {
      wx.showToast({ title: err, icon: "none" });
      return;
    }
    const f = this.data.form;
    const payload = {
      title: buildTitle(f),
      location: f.location.trim(),
      capacity: Number(f.capacity),
      startTime: toTimestamp(f.date, f.startTime),
      endTime: toTimestamp(f.date, f.endTime),
      description: f.description.trim(),
    };

    this.setData({ submitting: true });
    const type = this.data.isEdit ? "event.update" : "event.create";
    if (this.data.isEdit) payload._id = this.data.eventId;

    request(type, payload, { loading: true, loadingText: "提交中..." })
      .then(() => {
        wx.showToast({ title: this.data.isEdit ? "已保存" : "发布成功" });
        setTimeout(() => wx.navigateBack(), 600);
      })
      .catch(() => {})
      .finally(() => this.setData({ submitting: false }));
  },
});
