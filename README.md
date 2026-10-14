# 极速 AI 文档

极速 AI 的使用文档，包含平台介绍、CC Switch 配置、GPT 生图画布和 API 接入教程。基于 Vue 3、TypeScript 和 Vite，支持全文搜索、深色模式与手机阅读。

## 本地运行

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

打开 `http://127.0.0.1:5173`。

## 文档维护

在 `content/index.json` 中维护标题、分类和页面路径，在 `content/*.html` 中编辑正文，配图放在 `public/media/`。

```sh
npm run update:docs
npm run check:content
npm run build
```

常用页面：

| 页面 | 路径 |
| --- | --- |
| 首页 | `/` |
| 常见问题 | `/faq` |
| 平台使用指南 | `/guide` |
| CC Switch 配置 | `/tools/cc-switch` |
| GPT 生图画布 | `/image/canvas` |
| 图片 API | `/image/api` |
| 通用 API | `/api` |
| 错误排查 | `/help` |

构建产物在 `dist/`。运行 `npm run preview` 预览，运行 `npm run test:e2e` 检查页面与交互。

## Docker 部署

```sh
docker run -d --name jisuai-docs --restart unless-stopped -p 8080:8080 ghcr.io/drunkard-baifeng/jisuai_docs:latest
```

打开 `http://localhost:8080`。使用本地源码部署可运行 `docker compose up -d --build`。

使用其他静态服务器时，请将未匹配的页面路径回退到 `index.html`；Nginx 可使用 `try_files $uri $uri/ /index.html;`。
