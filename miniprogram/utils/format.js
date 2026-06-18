// 通用格式化工具

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

// 时间戳 -> "MM月DD日 HH:mm"
function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// 时间戳 -> "YYYY-MM-DD"
function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 时间戳 -> "HH:mm"
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 活动开始-结束时间展示
function formatEventTime(start, end) {
  if (!start) return "";
  if (!end) return formatDateTime(start);
  return `${formatDateTime(start)} - ${formatTime(end)}`;
}

const STATUS_TEXT = {
  open: "报名中",
  full: "已满",
  closed: "已结束",
  cancelled: "已取消",
};

function statusText(status) {
  return STATUS_TEXT[status] || status || "";
}

module.exports = {
  formatDateTime,
  formatDate,
  formatTime,
  formatEventTime,
  statusText,
};
