// 统一云函数调用封装
// 约定云函数返回 { code, msg, data }，code===0 为成功
const CLOUD_FUNCTION_NAME = "quickstartFunctions";

// 把微信/云开发底层错误转成友好文案
function normalizeCloudError(err) {
  const errMsg = (err && err.errMsg) || "";
  if (errMsg.includes("Environment not found")) {
    return "云环境未找到，请检查 app.js 中的 env 配置";
  }
  if (errMsg.includes("FunctionName parameter could not be found")) {
    return "云函数未部署，请先上传并部署 quickstartFunctions";
  }
  if (errMsg.includes("cloud.init")) {
    return "云能力未初始化";
  }
  return err && err.message ? err.message : "网络异常，请稍后重试";
}

/**
 * 调用云函数
 * @param {string} type 接口类型，如 'event.list'
 * @param {object} data 业务参数
 * @param {object} options { loading, loadingText, toast }
 * @returns {Promise<any>} resolve 业务 data，reject Error(带 code)
 */
function request(type, data = {}, options = {}) {
  const { loading = false, loadingText = "加载中...", toast = true } = options;
  if (loading) {
    wx.showLoading({ title: loadingText, mask: true });
  }

  return wx.cloud
    .callFunction({
      name: CLOUD_FUNCTION_NAME,
      data: { type, data },
    })
    .then((res) => {
      const result = (res && res.result) || {};
      if (result.code === 0) {
        return result.data;
      }
      const e = new Error(result.msg || "操作失败");
      e.code = result.code;
      if (toast) {
        wx.showToast({ title: e.message, icon: "none" });
      }
      throw e;
    })
    .catch((err) => {
      // 业务错误已带 code，直接抛出（避免重复 toast）
      if (err && typeof err.code === "number") {
        throw err;
      }
      const msg = normalizeCloudError(err);
      if (toast) {
        wx.showToast({ title: msg, icon: "none" });
      }
      const e = new Error(msg);
      e.code = -1;
      throw e;
    })
    .finally(() => {
      if (loading) {
        wx.hideLoading();
      }
    });
}

module.exports = { request };
