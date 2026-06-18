import { dispatch, RequestEvent } from "./router";

// 云函数入口：只负责把请求交给 router 分发
export const main = async (event: RequestEvent) => {
  return dispatch(event);
};
