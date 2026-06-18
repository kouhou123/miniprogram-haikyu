# 活动预约报名系统（微信小程序 + 云开发）

基于微信云开发的活动预约报名小程序，支持活动发布管理、报名/取消、人数管理、照片上传，区分「活动组织者」与「普通报名者」两种角色。

## 功能

- 活动发布与管理（组织者）：发布、编辑、关闭报名、取消活动、上传照片、查看报名名单
- 报名/取消报名（所有用户）：报名时用事务校验，杜绝超额
- 人数管理：每个活动设置人数上限，自动维护已报名数与「已满」状态
- 单一时间段：每个活动有开始/结束时间
- 角色控制：组织者通过 openid 白名单（`organizers` 集合）授权

## 目录结构

```
cloudfunctions/quickstartFunctions/   云函数（TypeScript 分层）
  src/
    index.ts        入口
    router.ts       路由分发 + 统一异常处理
    core/           response/errors/validate/context/auth/cloud
    db/collections  集合常量
    modules/        user / event / registration / photo 业务模块
miniprogram/
  utils/            request(统一调用) / auth(登录态) / format(格式化)
  pages/            index(活动列表) / eventDetail / eventEdit / myRegistrations / profile
```

## 数据集合

| 集合 | 说明 |
|------|------|
| `users` | 用户基本信息（openid、昵称、头像、手机号） |
| `events` | 活动信息（标题、时间、地点、人数上限、已报名数、状态、组织者） |
| `registrations` | 报名记录（eventId、openid、状态） |
| `photos` | 活动照片（eventId、fileID、上传者） |
| `organizers` | 组织者白名单（openid） |

接口统一返回 `{ code, msg, data }`，`code === 0` 为成功。

## 部署步骤

1. 在 `miniprogram/app.js` 的 `globalData.env` 填入你的云开发环境 ID。
2. 进入云函数目录构建 TypeScript：

```bash
cd cloudfunctions/quickstartFunctions
npm install
npm run build
```

3. 在微信开发者工具中右键 `cloudfunctions/quickstartFunctions`，选择「上传并部署：云端安装依赖」。
4. 在云开发控制台「数据库」中创建集合：`users`、`events`、`registrations`、`photos`、`organizers`（首次调用相关接口也会自动创建对应集合）。
5. 配置组织者：在 `organizers` 集合中新增文档 `{ "openid": "你的openid" }`。可先在小程序「我的」页面登录后，于 `users` 集合查看自己的 openid。

## 云函数开发

云函数源码为 TypeScript，位于 `src/`。修改后需重新 `npm run build`（或 `npm run watch` 监听）生成根目录的 `index.js` 等再上传。

## 参考文档

- [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
