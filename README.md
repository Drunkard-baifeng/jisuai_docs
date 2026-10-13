# 极速 AI 文档

使用 Vue 3、TypeScript 和 Vite 构建的 jisuai.net 独立文档站。包含 4 个分类、8 篇文档，正文、配置示例、链接和品牌统一使用 jisuai.net。「自动配置工具」提供 CC Switch 多应用配置图文教程及 6 张操作配图；「GPT 生图 · 画布使用」提供极速画布渠道配置与生图流程及 9 张操作配图。

## 本地运行

需要 Node.js 22.12+（或 20.19+）。

~~~sh
npm install
npm run dev
~~~

打开 http://127.0.0.1:5173。首页为 /?doc=introduction，保留 /docs/?doc=xxx 链接格式。

## 构建与检查

~~~sh
npm run check:content
npm run build
npm run test:e2e
npm run preview
~~~

浏览器测试验证 dist/ 中的构建产物，测试前先执行 npm run build。本地使用 Chrome；CI 自动安装 Playwright Chromium。产物在 dist/，可交由静态服务器部署。

## Docker 部署

镜像：`ghcr.io/drunkard-baifeng/jisuai_docs:latest`。容器使用非 root 的 Nginx，监听 8080 端口，支持文档深链接、静态资源缓存及 `/healthz` 健康检查。

使用已发布镜像：

~~~sh
docker run -d --name jisuai-docs --restart unless-stopped -p 8080:8080 ghcr.io/drunkard-baifeng/jisuai_docs:latest
~~~

使用本地源码构建：

~~~sh
docker compose up -d --build
~~~

打开 `http://localhost:8080`。Compose 默认使用只读文件系统、临时目录及最小权限；通过环境变量 `PORT` 可以调整宿主机端口。更新镜像可运行 `docker compose pull && docker compose up -d --no-build`。生产域名的 HTTPS 由外层反向代理配置。

## GitHub Actions 与发布

`.github/workflows/build.yml` 在 main 分支推送、PR、v 开头的版本标签及手动触发时运行：

1. 安装锁定依赖，检查本地维护内容是否同步，检查内容与类型并构建网站。
2. 在 Chromium 中测试全部页面、搜索、复制、深链接及移动端导航。
3. 生成 `jisuai-docs.tar.gz`、`jisuai-docs.zip` 和 `SHA256SUMS`，上传到运行记录的 `jisuai-docs-static` 构建产物。
4. 构建 Docker 镜像，启动只读、非 root 容器，检查健康接口、文档深链接、图片和缺失资源的 404 响应。
5. main 与版本标签的运行通过检查后，将 Linux amd64 / arm64 镜像发布到 GHCR。PR 只验证，不发布。
6. 推送版本标签时，创建对应 GitHub Release 并附加静态压缩包与校验文件。

main 发布 `latest`、`main` 和 `sha-...` 镜像标签；例如 `v1.0.0` 发布 `1.0.0`、`1.0` 和 `sha-...`。发布版本示例：

~~~sh
git tag v1.0.0
git push origin v1.0.0
~~~

Actions 使用仓库内置的 `GITHUB_TOKEN` 上传 GHCR，无需配置 Docker Hub 密钥。首次创建的 GHCR 包可能需要在包设置中改为 Public 才能匿名拉取；私有包请先用具有 `read:packages` 权限的令牌登录 GHCR。Actions、Docker 基础镜像锁定到提交或摘要，Dependabot 每周检查 npm、Actions 和 Docker 更新。

## 功能

- 分类导航、前后篇跳转、浏览器前进后退与可分享深链接
- 全文搜索（标题、摘要和正文），Ctrl / Cmd + K 快捷键
- 本页目录及滚动高亮，代码高亮、代码复制、页面链接复制
- 移动端抽屉、明暗主题、键盘操作与搜索焦点约束
- 阅读反馈保存在当前浏览器，不会发送到服务端
- 文档、字体和图片均随构建本地提供，不需要请求原文档站

## 编辑与重新采集

文档在 src/data/docs.json，每篇包含标题、分类、摘要、原始更新时间和经过清理的 HTML 正文。修改该文件即可维护内容。

「自动配置工具」由本站独立维护，源文件为 content/auto-config.html。修改后运行 npm run update:docs，将教程及关联文案写入文档数据。六张操作截图位于 public/media/cc-switch-*.png，包含多应用列表及「显示」开关、密钥导入和 Codex 配置示例。「设置 → 应用配置 → Codex」中的两个推荐选项，以及获取模型列表和重启守护进程的说明，均明确标注为 Codex 专属操作。更新日期为 2026-10-14，操作流程来自用户提供的步骤与截图。

「GPT 生图 · 画布使用」由本站独立维护，源文件为 content/gpt-image-canvas.html，入口为 /?doc=gpt-image-canvas。九张截图位于 public/media/canvas-*.png，明确区分文本渠道（https://jisuai.net）与生图渠道（https://api.jisuai.net），并说明生图分组密钥、拉取模型与生图工作台的操作流程。内容来自用户提供的步骤与截图，更新日期为 2026-10-14。修改后同样运行 npm run update:docs；重新采集时会保留此教程与导航入口。

scripts/sync-docs.mjs 可从同结构站点重新抓取：

~~~sh
npm run sync:docs -- --source "https://文档来源域名/docs/?doc=introduction"
~~~

脚本读取站点公开的文档目录与数据，通过 AST 提取静态内容，不执行远程 JavaScript；下载引用图片，清理 HTML，规范站内链接，替换域名和品牌，并输出 reports/content-sync.json。重新采集后会自动应用本站 CC Switch 教程及关联说明，避免恢复旧的自动配置内容。scripts/apply-local-docs.mjs 中的 removedArticleSlugs 记录用户要求移除的 13 篇文章，更新与重新采集都会从正文数据及导航中排除，搜索也不会收录。其余文章仍会被来源数据覆盖，手工修改前请先备份。

源站个人微信联系方式已改为控制台支持说明；已移除页面的旧配图与处理代码已清理。导入报告保留采集时间、源文件摘要、篇数及变更记录。图片清单根据实际文章引用生成，内容检查会阻止遗漏或无用图片进入发布包。

## 发布前业务核对

除本站维护的 CC Switch、极速画布教程及关联说明外，迁移保留了原文中的模型清单、分组、计费说明和示例。jisuai.net 的实际 API、控制台路由、分组和模型是否与教程一致，需要站点运营方核对；这些业务服务不由本前端项目实现。导入文章保留原文日期，本地维护文章使用实际更新日期，采集及本地覆盖记录保存在导入报告中。

## Nginx 部署示例

~~~nginx
server {
    listen 80;
    server_name docs.jisuai.net;
    root /var/www/jisuai-docs/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
~~~

此示例用于独立文档域名。生产环境应配置 HTTPS。
