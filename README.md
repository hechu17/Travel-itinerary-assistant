# 旅行地点规划助手

一个基于 React、Vite 和高德地图 JS API 的旅行路线规划工具。它可以帮助用户搜索国内地点、组织多目的地行程、按交通方式规划路线、查看日程时间线，并记录旅行预算。

## 功能特性

- 高德地图路线仪表盘：展示目的地标记和多段路线。
- 地点搜索与联想：通过高德 `AutoComplete` 和 `PlaceSearch` 搜索国内地点。
- 多交通方式规划：支持驾车、公交、步行和骑行路线。
- 行程链管理：添加、删除、排序目的地，并设置停留时间和旅行天数。
- 日程看板：根据出发日期、开始时间、停留时间和路线耗时生成时间线。
- 预算账本：记录门票、餐饮、住宿、交通等旅行支出，并统计预算使用情况。
- 移动端适配：页面已适配手机视图，地图和控制面板在小屏幕下自动变为单列布局。

## 技术栈

- React 19
- Vite 8
- 高德地图 JS API 2.0
- `@amap/amap-jsapi-loader`
- Lucide React 图标

## 本地运行

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认访问地址：

```txt
http://127.0.0.1:5173/
```

构建生产版本：

```bash
npm run build
```

本地预览生产构建：

```bash
npm run preview
```

## 高德地图配置

项目需要配置高德开放平台的 Web 端 JS API 凭证。

在高德开放平台创建应用时，请选择：

```txt
应用类型：Web 端（JS API）
API 版本：JS API 2.0
```

运行项目后，点击地图右上角的设置按钮，填写：

- 高德 Web JS API Key
- Security JS Code 安全密钥

本地开发时，建议在高德控制台的 Referer 白名单中加入：

```txt
http://localhost:5173
http://127.0.0.1:5173
```

如果 Vite 使用了其他端口，也需要把对应地址加入白名单。

## 生产环境 serviceHost 代理

正式部署时建议使用高德 `serviceHost` 代理方案，不要把 `securityJsCode` 明文暴露在前端。

### CloudBase 部署

面向中国大陆访问，推荐使用腾讯云 CloudBase：

- `dist` 静态资源部署到 CloudBase 静态网站托管。
- `cloudfunctions/amap-service` 部署为 HTTP 云函数。
- 高德 `Security JS Code` 放在云函数环境变量 `AMAP_SECURITY_JS_CODE` 中。

CloudBase 环境变量建议：

```txt
VITE_AMAP_KEY=你的高德 Web JS API Key
VITE_AMAP_SERVICE_HOST=https://你的 HTTP 云函数域名/_AMapService
AMAP_SECURITY_JS_CODE=你的高德 Security JS Code
```

其中：

- `VITE_AMAP_KEY` 用于前端加载高德 JS API。
- `VITE_AMAP_SERVICE_HOST` 指向 CloudBase HTTP 云函数代理地址。
- `AMAP_SECURITY_JS_CODE` 只配置在 `amap-service` 云函数环境变量里，不要写进前端代码。

部署步骤建议：

1. 在腾讯云 CloudBase 创建环境。
2. 在 CloudBase 静态网站托管中连接 GitHub 仓库或使用 CLI 部署。
3. 构建命令填写 `npm run build`，输出目录填写 `dist`。
4. 部署 `cloudfunctions/amap-service` 云函数。
5. 为 `amap-service` 云函数配置环境变量 `AMAP_SECURITY_JS_CODE`。
6. 开通该云函数的 HTTP 访问，并将得到的 HTTP 访问域名配置为前端环境变量 `VITE_AMAP_SERVICE_HOST`。
7. 重新构建并部署前端。

项目提供了 `cloudbaserc.example.json` 作为 CloudBase CLI 配置参考。复制为 `cloudbaserc.json` 后，将 `envId` 改成你的 CloudBase 环境 ID，再按实际控制台配置调整。

### Vercel 部署

本项目也保留了 Vercel 代理：

- 前端生产环境默认使用 `/_AMapService` 作为 `serviceHost`
- `vercel.json` 会把 `/_AMapService/*` 转发到 `/api/amap/*`
- `api/amap/[...path].js` 会在服务端读取 `AMAP_SECURITY_JS_CODE` 并转发到高德服务

部署到 Vercel 时，需要配置环境变量：

```txt
VITE_AMAP_KEY=你的高德 Web JS API Key
VITE_AMAP_SERVICE_HOST=/_AMapService
AMAP_SECURITY_JS_CODE=你的高德 Security JS Code
```

其中：

- `VITE_AMAP_KEY` 会进入前端包，属于可公开的 Web JS API Key。
- `AMAP_SECURITY_JS_CODE` 只在 Vercel Serverless Function 中读取，不会打包进前端。
- `VITE_AMAP_SERVICE_HOST` 不填时，生产构建会默认使用当前域名下的 `/_AMapService`。

本地开发仍然可以使用页面设置弹窗手动填写 Key 和 Security JS Code。

## 地图服务能力

当前项目会使用以下高德能力：

- `AMap.Map`：地图渲染
- `AMap.AutoComplete`：地点输入联想
- `AMap.PlaceSearch`：POI 地点搜索
- `AMap.Driving`：驾车路线
- `AMap.Walking`：步行路线
- `AMap.Riding`：骑行路线
- `AMap.Transfer`：公交路线

地图面板右上角的盾牌按钮可以检查搜索和路线服务权限。

## 项目结构

```txt
src/
  App.jsx                         应用主布局与状态管理
  components/
    MapContainer.jsx              高德地图展示、路线绘制、服务诊断
    DestinationList.jsx           地点搜索、目的地列表、交通方式选择
    ItineraryTimeline.jsx         行程时间线
    BudgetTracker.jsx             预算与支出记录
    TransportSelector.jsx         交通方式选择控件
  utils/
    amapDiagnostics.js            高德错误信息解析
```

## 注意事项

- 本地开发时，高德 Key 和 Security JS Code 可以保存在浏览器 `localStorage`。
- 正式部署时，建议使用上面的 `serviceHost` 代理方案，避免把 `securityJsCode` 明文暴露在前端。
- 旅游地点、预算和凭证配置同样使用浏览器 `localStorage` 保存，清理浏览器数据会重置这些信息。
