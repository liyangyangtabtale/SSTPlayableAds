# PlayableStudio — Super Stylist 3D 换装试玩

交付物是 **Dashboard（Playable Studio）**：一个双击即可打开的单文件 HTML，让广告团队不改代码就能配置并导出试玩包。
规格文档：《Super Stylist 3D 换装试玩 · 功能规格》（团队共享文档）。

## 三个部分
| 部分 | 位置 | 说明 |
|---|---|---|
| 试玩运行时 | `src/runtime/` | Three.js 试玩本体：开场(手机气泡) → 换装四阶段 → 结局；只读配置 + 资源包。预览和导出的成品共用这份代码 |
| Studio 面板 | `src/studio/` | 配置面板 + 资源库(上传、校验、压缩、自动图标) + 实时预览 + 校验 + 按渠道导出 |
| Unity 导出工具 | `tools/unity-export/` | 只读 Unity 工程，导出 Studio 能导入的资源包(ZIP)。见 `docs/unity-export.md` |
共用：`src/shared/`（配置格式 `schema.js`、资产模型 `assets.js`、动画格式 `anim-format.js`、glb 压缩 `glb-optimize.js`、base91 `b91.js`）。

## 命令
```bash
npm install
npm run build:placeholder   # 用旧 PlayableWeb 里的资源生成占位资源包 assets/placeholder (只用来跑通流程)
npm run build               # 运行时 → Studio 内嵌数据 → dist/PlayableStudio.html (双击打开)
npm run dev:runtime         # 只开发运行时：http://127.0.0.1:5190 (读 public/dev-data.js)
npm run export:unity -- --project <Unity 工程> --out pack.zip
```

## 数据流
```
Unity 工程(美术放资源) ──导出工具──▶ 资源包 ZIP(raw) ──Studio 导入(校验/压缩/图标)──▶ 资源库(浏览器本地)
                                                                   │
配置(JSON)  ◀── Studio 面板编辑 ──────────────────────────────────┤
   │                                                              ▼
   └──────────── 运行时模板 + 配置 + 用到的素材(base91 内联) ──▶ 预览 iframe / 渠道导出(单 HTML 或 ZIP)
```
- 配置只通过**资产 id** 引用素材；资源库里每个素材是 `{id,type,name,files,meta}`（见 `src/shared/assets.js`）。
- 角色 = 统一骨架 + 部件；外观 = 同一模型换贴图；服装/发型/鞋是蒙皮到同一骨架的 glb；材质(镂空/半透明/双面)用 glTF 标准语义；脸部表情 = 形变目标，动画存成紧凑 `.anim`。
- 导出只打包**当前主题**用到的素材。ZIP 渠道(Google / TikTok)的体积按压缩后计算，所以余量比单 HTML 渠道大。

## 当前状态（框架版）
已完成并验证：运行时全流程(开场开关/结局开关/阶段顺序与开关/素材池与好坏/旋转/手机气泡/闪白转场/音效/动作组)、Studio 的所有配置面板、多主题、资源上传(服装/发型/鞋/妆容/外观/背景/音效/动画/手机，含校验、压缩、自动图标)、资源包导入导出、项目保存/打开、渠道导出、Unity 导出工具(用旧 Unity 工程实测通过)。

**还没做 / 需要后续确认**
- 画风与着色：现在是通用的“包裹光 + 轮廓光”着色，等美术方向定了再换；所有模型目前固定为不受光照(只显示贴图色)，阴影大小/浓淡/左右位置可在面板里调。
- 美术资产：目前全是占位(旧工程资源 + 合成音效)。新资源到位后用导出工具导入即可，不需要改代码。
- 屏幕比例：运行时舞台固定 9:16 居中，更窄/更长的屏幕两侧留边；横屏不支持(已确认)。
- 渠道出口：各渠道的 CTA / 就绪 / 静音逻辑是按《Playable Ads Development Guidelines》写的基础适配，**还没有在各渠道的真实测试环境里验证**；TikTok `config.json` 字段、Google 的 meta 声明需要对照官方文档核对。
- 低端机降级(关抗锯齿、简化阴影)未实现；WebGL 不可用时只显示背景和 CTA 按钮。
- 脸部表情的形变权重没有按“实际用到的动画”裁剪，体积还有优化空间。
- 浏览器：上传的图片要在 Chrome / Edge 里转 webp(Safari 不支持 webp 编码，会退回 png)。
- 横幅/字体：目前只有 3 个样式 + 3 个系统字体预设，自定义字体和更多样式待美术/需求确认。
