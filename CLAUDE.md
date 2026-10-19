# CLAUDE.md — SSTPlayable3D（Super Stylist 3D 换装可玩广告）

## 项目概述

- 由 Super Stylist 主工程精简而来的**独立 Unity 项目**（Unity 6000.3.13f1，Built-in 管线），用于做 3D 换装可玩广告的玩法原型和配置。
- 流程：换装（衣服 → 妆容 → 发型 → 鞋）→ 好/坏结局。需求见《超级造型师_3D换装_中文版.pptx》。
- 最终产物是 Three.js 单 HTML 可玩广告（`PlayableWeb/`），Unity 端负责玩法和配置，之后转换到 Three.js。
- 精简前的完整工程仍在 `~/Cocomyboutique_scene`（原工程拷贝，Unity 6000.3.13f1）。需要原资源时从那里按需补回。

## 目录

| 路径 | 说明 |
|------|------|
| `Assets/_Game/CocoPlay/Role` | 角色基础身体/头部、衣服、鞋、发型资源 |
| `Assets/_Game/CocoPlay/{Inherent,Outfit,PickStyle}` | 动画 FBX |
| `Assets/_Game/CocoPlay/Makeup*`、`Role/RuntimeResources/mu` | 妆容贴图 |
| `Assets/GenericFramework`、`GameCommon` | 仅保留被材质引用的 Shader |
| `Assets/DynamicBone` | 发型物理骨骼 |
| `PlayableWeb/` | Three.js 版本及资源管线（`tools/*.mjs`），路径依赖上面的 Assets |

## 约定

- 使用**中文**回复。
- 改动保持最小，不做无关重构。
- 玩法配置数据化（ScriptableObject/JSON），逻辑与表现分离，Shader 只用简单的 Lit/Unlit + 基础贴图，方便转 Three.js。
- 新增资源只引入 MVP 需要的（1 主题、1 角色、4 阶段各 6 个选项）。
- 不在项目里引入原工程的框架和 SDK。

## Unity 端（Assets/Playable）

- `Scripts/Runtime`：`PlayableConfig`（配置 SO，相当于控制面板）、`PlayableGame`（流程）、`CharacterDresser`（按骨骼名重绑拼装角色）、`CharacterAnimator`（PlayableGraph 播 clip）、`CameraRig`、各 UI 面板。**每个 MonoBehaviour 必须单独一个同名文件**，否则预设里脚本引用会丢。
- `Scripts/Editor`：菜单 `Playable/`：1 生成默认配置 → 2 生成 UI 预设 → 3 生成 Main 场景 → 4 导出 `PlayableWeb/public/config.json`。命令行一键：
  `Unity -batchmode -quit -projectPath . -executeMethod SSTPlayable.Editor.SceneBuilder.BuildAll`
- 无人值守验证（自动走完流程并截图到目录）：
  `Unity -batchmode -projectPath . -executeMethod SSTPlayable.Editor.SmokeRun.Run -playableCapture -captureDir <dir>`
- 发型图标烘焙：同上再加 `-bakeIcons -captureDir Assets/Playable/UI/Icons`，之后重跑 BuildAll 挂图标。
- 配置里改阶段顺序/开关/选项数/素材池/好坏标记/主题文案/镜头，改完 `Export Config JSON` 同步给 Web。
- 原工程材质里有一批断掉的贴图引用（原游戏运行时按名字赋值）：发型 `_MainTex`、眼睫毛、眼影的 `_EyeShadowTex/_GradualTex` 等，已在 `CharacterDresser` 里显式覆盖，新增同类部件要注意。
- 原项目拷贝 `~/Cocomyboutique_scene` 仍在，缺资源（含 shader 的 `#include` 头文件，闭包按 GUID 找不到）从那里补。
- UI 布局参考 PPT 第 3 页：顶部标题横幅（`theme.title`，仅换装阶段显示）、左侧角色、右侧面板（顶部阶段图标页签 + 2 列网格）、面板下方 Confirm 按钮（选中前灰色，确认后进入下一阶段）。开场：待机 → 短信到达(气泡出现 + 看手机) → 反应 → 回待机；换装选对/选错各有反馈动画，播完回待机；换装全程固定同一镜头(`full`)。参考分辨率 1080x1920。
- 背景是程序化绘制的占位图（`BackgroundGenerator`），正式美术图到位后替换 `theme.backgroundImage` 即可。页签图标由 `PlayableWeb/tools/make_icons.mjs` 生成，可直接替换 `StageConfig.icon`。
- **用 Unity 编辑器打开本工程时，命令行 batchmode 会被工程锁挡住**（我验证时是在工程副本里跑的，再把 Config/UI/Scenes 同步回来）。

## Web 端（PlayableWeb，Three.js）

- 运行时完全由 `public/config.json` 驱动（Unity `Export Config JSON` 导出）：主题/背景图/文案、角色皮肤、动画序列、阶段顺序与开关、素材池、网格数、好坏标记。流程与 Unity 端一致：待机 → 短信气泡 + 看手机 → 反应 → 待机 → 换装(选择 + Confirm，选对/选错有反馈动画，固定镜头) → 好/坏结局。
- UI 用 HTML/CSS，所有尺寸按 1080x1920 参考分辨率换算（`--u` = 舞台宽度/1080），舞台最宽 9:16 居中。背景是 CSS 图片，角色画布透明叠在上面；角色靠 `camera.setViewOffset` 放在屏幕左 29%。
- 资源管线 `tools/*.mjs`：`build_char.mjs`(动画，`ONLY=a,b` 只构建指定的)、`build_base.mjs`、`build_items.mjs`；背景/页签图标由 Unity 端生成的 PNG 用 sharp 转到 `public/assets/ui/`。
- 注意：`base.glb` 里身体网格的骨骼名带 `_1` 后缀，`Character.attach` 会去后缀再映射到动画骨架；不处理会导致身体不跟动画。
- 构建：`npm run build` = vite 单文件 → `tools/pack.mjs`(压缩资源并内联，产出 `dist/playable.html`，约 4.2MB，可脱离 http 独立运行) → `tools/build_dashboard.mjs`(产出 `dist/dashboard.html`，控制台)。资源压缩：base.glb 去形变目标 + 量化(不量化 UV，且 prune 要 keepAttributes) + meshopt；items 量化 + meshopt；动画去掉骨架里没有的骨骼轨道/缩放轨道并按 `anims.max` 截断 + meshopt。
- **控制台** `dist/dashboard.html`（源码 `tools/dashboard/`）：左侧改文案/结局/背景/角色皮肤/阶段顺序与开关/网格列数与可见数/素材池(勾选、排序、Good/Bad)/商店链接，右侧实时预览(iframe)，带校验；导出 = 只保留最终配置用到的资源的单文件试玩 html，或导出/导入 config.json。试玩模板和素材都内联在控制台里。素材池来自打包时 `config.json` 里列出的全部选项，新增素材(新模型/新动画)需先在 Unity 导出后重新 `npm run build`。**图片类资源可在控制台里直接替换**：背景图、阶段页签图标(自定义彩色图标用 `stage.iconCustom`)、皮肤/眼部贴图、每个素材的网格图标、妆容贴图、衣服/发型/鞋的模型贴图(浏览器里改写 glb，含 meshopt 压缩的 glb)；替换保存在内存的 OV 表里，随导出写入试玩；用"保存项目/打开项目"(.json，含图片)保存和恢复工作进度。
- 开发：`cd PlayableWeb && npx vite --host 127.0.0.1`（端口 5180），用 http 打开，别双击文件。
- Web 端必须通过 http 打开（`npm run dev` 或双击 `PlayableWeb/启动试玩.command`，地址 http://127.0.0.1:5180）；直接双击 html（file://）会一直停在 Loading。内联成单文件 HTML 后才能双击打开。

## 角色 / 默认外观 / 妆容（2026-10-13 调整）

- **角色只有一套资源**：`CharacterVariant` 只保留一个条目（`webBodyTex`/`webHeadTex` = 贴图文件名，默认 `body_101`/`head_101`，眼睛贴图 `eyebrow`/`eyelash`/`eyeball`）。导出 `config.character = {body,head,eyebrow,eyelash,eyeball}`。更换头/身体/眼睛 = 在控制台"图片资源"里替换这几张贴图。
- **默认外观** `PlayableConfig.defaults`（`DefaultLook`）：开场角色就穿着默认衣服 + 默认发型。`outfits` 是候选的几件默认衣服(控制台里选用哪一件，`outfitIndex`)，`hair` 是默认发型。默认资源先用 001：衣服 `romantic_dress_001`/`denim_dress_001`，发型 `hair_001`。导出 `config.defaults = {outfits:[...],outfit,hair}`（文件名带 `_c1`）。选了新衣服/发型会替换它们。Web 端打包会把默认衣服/发型的模型和图标一起带上。
- **妆容改为改头部材质的 `_FacePaintTex`**（不再用 eyeshadow 网格/材质）：Unity `CharacterDresser.Equip(Makeup)` 给头部材质实例设 `_FacePaintTex`；Web 端 `Character.makeup()` 把 facepaint 贴图画到头部贴图上(CanvasTexture)。facepaint 贴图必须是**头部 UV 布局的 RGBA 贴图**(和 `head_101` 同布局，1024)。Web 打包会去掉 base.glb 里的 eyeshadow 网格。
- 现有 6 张 facepaint 是**占位**：`PlayableWeb/tools/make_facepaint.mjs` 把旧眼影小图合成到头部 UV 的双眼位置，输出到 `Assets/Playable/Makeup/facepaint_00N.png`(+Web `tex/` `icons/`)。正式 facepaint 到位后，直接替换 `Assets/Playable/Makeup/facepaint_00N.png`，重跑 BuildAll；妆容图标由 `-bakeIcons` 烘焙(去掉头发的 3D 脸部特写)，存到 `Assets/Playable/UI/Icons/<id>.png`，再转 webp 放进 Web 的 `icons/`。

## 结局男角色 boy_player02（2026-10-14）

- 资源：`Assets/_Game/CocoPlay/boy/`：`boy_player02.FBX` 只有骨架，身体/头/头发/衣服/眼睛/睫毛/舌头(`boy_she`，用头部贴图图集)是 7 个独立 FBX 部件 + `boy_*.mat`。材质用 `TC/Diffuse/Basic` 着色器，已从 `~/Cocomyboutique_scene` 补进 `GenericFramework/CocoCoreModule/TCShader/Shaders/`。
- Unity：`PlayableConfig.partner`（`PartnerConfig`）：骨架 + 部件列表(复用 `CharacterDresser.BasePart`) + `walkAnim/goodAnim/badAnim` + `startPos/endPos`(Unity 世界坐标，屏幕左边 = +x) + `walkSpeed/walkYaw/endYaw`。`PlayableGame.EndingSequence`：女角色待机 → 男角色从左边走进来(走路动画 + 线性移动) → 站定转向 → 两人按好/坏结局做反应。动画目前和女角色共用同一批 clip(walk/win/lose)，之后在配置里逐个替换。结局镜头 `ending` = (0.45,1.25,6.4)，居中在两人之间。
- `CharacterDresser` 骨盆锁定改为**相对角色根节点**计算（否则角色整体移动会被抵消）；Web 端 `Character.lockPelvis` 同理。
- Web：`config.partner = {rig,parts:[{model,tex}],startX,endX,walkSpeed,walkYaw,endYaw,anims}`（Unity 坐标）；`src/partner.js` 的 `Partner extends Character`，部件各带一张贴图(`assets/partner/<tex>.webp`)，动画 clip 与女角色共用(按骨骼名绑定)；Web 里 x/yaw 取负(three.js 右手系)。资源由 `tools/build_partner.mjs` 从 FBX/tga 转出；打包时骨架 glb 原样复制(不能 prune，否则骨骼节点被当空节点删掉)，部件走 `optimizeBase`(保留 UV、不量化 UV)。控制台导出的瘦身版本会保留男角色资源，"图片资源"里可替换男角色贴图。
- 体积：`dist/playable.html` 约 4.86MB(距 5MB 上限很近)。动画 resample 容差 0.004。再加资源前先考虑把资源包 gzip(+DecompressionStream)或进一步裁剪动画。

## 资源位置 / 配置生成（2026-10-14 调整）

- 服装/鞋/发型现在在 `Assets/_Game/CocoPlay/Role/role/{dress,shoes,hair}`（原来是 `Role/Resources/role`）。`dress`/`shoes` 每件一个文件夹(prefab + 材质 + png 图标)，`hair` 是 `models/hair_00N.prefab`。
- **配置生成器 `DefaultConfigBuilder` 现在自动扫描上面的目录**（不再硬编码名字）：每个服装/鞋文件夹取其中的 prefab、第一个 .mat、第一张 .png 作为选项，id = prefab 名字；发型扫描 `hair_*.prefab`。服装 8 件、鞋 6 双、发型 7 个全部进素材池，可见数量 6。资源移动/改名后运行菜单 `Playable/1. Create Default Config (重置现有配置)` 或命令行 `SceneBuilder.ResetAndBuildAll`。
- **`SceneBuilder.BuildAll`（日常构建）不再覆盖已有配置**：已有 `PlayableConfig.asset` 就保留，只重做 UI/场景/导出，并运行 `ConfigValidator`（菜单 `Playable/5. Validate Config`）检查所有资源引用，缺什么会在 Console 里逐条 warning。新增发型后需要重新烘焙图标(`-bakeIcons`)，再 `ResetAndBuildAll`。
- 默认外观目前取扫描到的前两件衣服(`casual_dress_010`、`designer_dress_134`)和 `hair_001`；在 `PlayableConfig.defaults` 里改即可。好/坏标记按固定模式生成(`GoodPattern`)，请在配置里按实际调整。
- 背景图：已有 `date_room.png` 不会被生成器覆盖，可以直接替换成正式美术。
- **结局男角色改为从屏幕右侧进来**：`partner.startPos=(-3.4,0,0)`、`endPos=(-0.85,0,0)`(Unity 屏幕右 = -x)、`walkYaw=90`、`endYaw=20`；女角色世界位置不动，结局镜头 `ending=(-0.37,1.25,5.8)`，女角色屏幕位置与换装时一致(偏左)。
- Web 端已跟进（见下节"打包流程"）。

## 打包流程与约定（2026-10-14，重要）

- **Unity 端是只读输入**：打包时不要生成、重置或修改 Unity 里的任何东西（`PlayableConfig.asset`、`Assets/Playable/{Config,UI,Scenes,Makeup}`、图标、导出的 config 内容）。配置由你在 Unity 里改，我只读取。**不要再运行 `SceneBuilder.*` / `DefaultConfigBuilder` / `-bakeIcons`，也不要把任何东西同步回 `Assets/`。**
- 配置导出：`PlayableWeb/public/config.json` 是 `PlayableConfig` 的导出结果。需要更新时，由你在 Unity 里用菜单 `Playable/4. Export Config JSON (Web)` 导出；我也可以在**工程副本**（scratchpad，用 `cp -c` 拷贝）里只执行 `ConfigExporter.Export`，再把结果原样放到 `public/config.json`（不改内容）。注意：磁盘上的 asset 才算数，编辑器里没保存的改动我看不到，请先保存。
- Web 资源转换（只写 `PlayableWeb/public/assets`）：`SCR=<临时目录> node tools/build_items.mjs` 由 `public/config.json` 驱动，把配置里的所有服装/鞋/发型(素材池 + 默认外观)转成 glb + 图标，并从 Unity 读取妆容 facepaint 贴图(`Assets/Playable/Makeup/*.png`)和烘焙图标(`Assets/Playable/UI/Icons/*.png`)；动画/基础模型/男角色用 `build_char.mjs`/`build_base.mjs`/`build_partner.mjs`（仅在这些资源变了时跑）。然后 `npm run build`。
- 开场角色穿的是 `config.defaults` 里的 `outfit` 和 `hair`（Web `Game.applyDefaults`，控制台"默认外观"里可选）。
- 结局：男角色从配置的 `partner.startX` 走到 `endX`(Web 里 x 取负)，Web 结局镜头固定为 `{x:0,y:1.25,d:5.8,shiftX:.21}`(与 Unity 的 ending 镜头一致，女角色屏幕位置不变)；镜头不在 config.json 里，Unity 改了镜头需要同步改 `src/game.js`。
- 体积：完整资源包 `dist/playable.html` 约 5.02MB，控制台"导出试玩"只保留可见素材，当前导出约 4.91MB(<5MB，余量很小)。已做的压缩：衣物贴图 webp 质量 70、动画 resample 容差 0.005；再要压只能整体 gzip 资源包(需 DecompressionStream)或砍动画/素材。
- 配置里的选项 id 若找不到同名资源(例如 id=`021`)，`build_items.mjs` 会在同类资源里按"唯一以 _<id> 结尾"推断(`021` -> `romantic_dress_021`)并打印 WARN，输出仍用配置里的名字；推断不唯一则报 FAIL。
- **最终交付文件**：`npm run build` 之后运行 `node tools/export_final.mjs`，生成 `dist/final/SuperStylist_playable_<日期>.html`（只保留当前 config.json 实际用到的资源，和控制台"导出试玩"一致；不含商店链接——config 里没有 `storeUrls` 时 CTA 只会触发 `mraid.open`/`window.openStore`/`playable-cta` 事件）。注意体积是 MiB：4.91 MiB = 5,145,942 字节 = 5.15 MB(十进制)，渠道若按 5,000,000 字节算就超了。

## "重新构建" = 完整流程（2026-10-14，用户定义）

用户说"重新构建"，就是**从 Unity 完整转成 Three.js 工程，再打包出 `dist/dashboard.html`**，每次都从头走一遍，不能只跑 `npm run build`。因为用户会改 Unity **代码**（Runtime/Editor 脚本、配置字段），Web 流程要跟着对齐。

一键脚本（只读 Unity，只写 `PlayableWeb/`）：

```bash
cd PlayableWeb && SCR=<scratchpad目录> ./tools/rebuild_all.sh
```

脚本做的事：① 在 scratchpad 拷一份 Unity 工程，用用户**当前的** Editor 脚本只执行 `ConfigExporter.Export`，结果原样写到 `public/config.json`；② `read_unity_extras.mjs` 从已保存的 `PlayableConfig.asset` 读出导出器没导出的节奏字段(`introBubbleDelay/introTapDelay/endingUiDelay/endingCtaDelay`)写到 `public/config.extra.json`（Web 侧文件，`config.json` 里已有的字段优先），`sync_ui_assets.mjs` 同步背景图和页签图标；③ 转换全部资源：`build_char`(动画) → `build_base`(基础模型 + 皮肤/眼睛贴图，眼球贴图按 `eyeball.mat` 的引用解析) → `build_items`(服装/鞋/发型/妆容，按配置) → `build_partner`(男角色)；④ `npm run build`。

**重新构建之前先做的事（别跳过）**：对比 Unity 代码有什么新改动（`find Assets -newer ...`、和上次的副本 diff），把 Unity 的玩法/流程改动在 Web 端补齐，再构建。例如这次补了：开场"看手机动画开始 → `introBubbleDelay` 出气泡 → `introTapDelay` 出 Tap 提示，此前点击无效"；结局"两人开始反应 → `endingUiDelay` 出文案 → `endingCtaDelay` 出 Play Now"（Web 里 `Game.T`/`intro()`/`showEndingUI()`）。导出器没导出的新字段，要么让用户在 `ConfigExporter` 里加，要么像这次一样从 asset 读到 `config.extra.json`。

重新构建踩过的坑：Unity 目录结构/文件改名后旧脚本路径会失效（`Role/Resources/role` → `Role/role`、`eyecolor_001` → `eyecolor_000`、`mu` 眼影贴图已移除）；新版 gltf-transform 的 `mergeDocuments` 会把被合并文档放进**第二个场景**，导致 `base.glb` 在网页里丢身体网格（`build_base` 已并回第一个场景，并 `unpartition` 合并 buffer）；每次重新构建后必须在浏览器里实际验证（部件是否齐全、开场/结局节奏）。
