# Unity 资源导出（Unity → Studio 资源包）

Unity 在这个项目里**只是资产来源**：美术把资源放进新 Unity 工程，导出工具把它们转成 Studio 能导入的资源包(ZIP)。导出工具**只读** Unity 工程，不会修改里面任何文件。

## 一、使用
```bash
cd PlayableStudio
npm install
node tools/unity-export/cli.mjs --project <Unity 工程根目录> --out assets-pack.zip
#   没有 export.json 时，按下面的约定目录自动发现(Assets/PlayableExport)
node tools/unity-export/cli.mjs --project <Unity 工程根目录> --spec export.json --out assets-pack.zip   # 用 export.json 精确指定
```
也可以把 `unity-editor/PlayableExportMenu.cs` 拷进 Unity 工程的 `Assets/Editor/`，用菜单 `Playable/1. 创建导出目录`、`Playable/2. 导出资源包`。
导出后在 Studio 里：**资源库 → 导入资源包(ZIP)**。导入时会自动校验、压缩、生成图标，不合格的素材会明确告诉你原因。

## 二、目录约定（`Assets/PlayableExport/`）
| 目录 | 放什么 | 说明 |
|---|---|---|
| `Character/` | `rig.fbx` + 每个部件一个 prefab(或 `<部位>.fbx` + 同名 `.mat`)：`head.prefab` `body.prefab` `eye.prefab` `brow.prefab` `lash.prefab`…(文件名 = 部位) | 统一骨架 + 各部位蒙皮网格。head/body/eye/brow/lash 这五个部位会被“外观”换贴图 |
| `Partner/` | 同上 | 男角色，只有一个 |
| `Looks/<名称>/` | `head.png body.png eye.png brow.png lash.png` | 一种外观 = 一组贴图，和基础模型 UV 一致(同一模型换贴图) |
| `Outfits/` `Hair/` `Shoes/` | 每件一个 prefab(蒙皮到统一骨架，材质带底色贴图)；同名 png/jpg 作为图标(可省，省了 Studio 自动渲染) | 一件有多个部件(如裙子 + 手套)放在同一个 prefab 里 |
| `Makeup/` | 头部 UV 的 RGBA png(带透明通道的脸绘) | 每个文件一个妆容 |
| `Animations/` | `*.fbx`，FBX 里每个 Clip(Animation 标签页切好的片段)成一个动画 | 文件名或 Clip 名以 `phone` 开头的当作手机动画；脸部表情用 BlendShape 曲线 |
| `Phone/` | `phone.prefab` | 开场用的手机(静态网格；动画放 Animations) |
| `Backgrounds/` | png/jpg | 开场/换装背景、结局背景，Studio 会按 9:16 居中裁切 |
| `Sounds/` | mp3 / wav / ogg | 音效，建议 3 秒以内 |

## 三、材质怎么转换
Unity 材质 → glTF 材质：底色贴图(`_MainTex`)、颜色(`_Color`)、**镂空**(`_Mode=Cutout` 或 `_ALPHATEST_ON`，阈值 `_Cutoff`)、**半透明**(`_Mode=Transparent/Fade` 或 `_ALPHABLEND_ON`)、**双面**(`_Cull=Off`)。其余着色器参数(法线、高光、自发光、Toon 贴图…)**不会带到 Web**——画面效果以 Studio 里的灯光/着色为准。

## 四、export.json 格式
见 `docs/unity-export.example.json`。字段：`character{rig,parts[{role,prefab | fbx+material}]}` `partner` `looks[{name,head,body,eye,brow,lash}]` `outfits/hair/shoes[{name,prefab,icon?}]` `makeup[{name,texture}]` `animations[{fbx,prefix?,kind?}]` `phone{prefab}` `backgrounds[{name,image}]` `sounds[{name,file,event?}]`。路径都是相对 Unity 工程根目录。
没有 prefab 的老资源可以用 `fbx` + `material`(.mat 路径) 代替 `prefab`。

## 五、已知限制
- prefab 套 prefab(Variant)暂不展开，请用普通 prefab。
- TGA 只支持无压缩/RLE 的 24/32 位，建议直接用 PNG。
- 骨骼名必须和统一骨架一致；导入时不一致会报错并列出缺的骨骼。

## 六、当前资源的整理结果
命名规则和旧名对照见 `docs/asset-naming.md`；依赖文件放在各目录的 `_src/` 子目录(以 `_` 开头的目录导出工具不扫描)。
