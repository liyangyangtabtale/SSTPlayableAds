# 资源命名对照（2026-10-19 整理）

所有美术资源已整理到 Unity 工程的 `Assets/PlayableExport/`，按约定目录放好，`node tools/unity-export/cli.mjs --project <工程根> --out pack.zip` 可直接导出(58 个素材，无警告)。
移动用的是“文件 + .meta 一起搬”，Unity 里的 GUID 不变，prefab/材质/贴图的引用不会断。旧目录里已经没有这些文件。

## 命名规则
- 服装 `outfit_NN`、鞋 `shoes_NN`、发型 `hair_NN`(NN 两位序号)；妆容 `makeup_NN`；背景 `bg_main`(开场/换装)、`bg_ending`(结局)。
- 每件服装/鞋/发型：`Outfits/outfit_01.prefab` + `outfit_01.png`(图标) 放在目录最外层(导出工具只扫这一层)，它依赖的 FBX/材质/贴图放在 `Outfits/_src/outfit_01/`(以 `_` 开头的子目录导出工具不扫)。
- 新增一件：复制一个 `_src/xxx` 目录改名，prefab/图标按下一个序号命名，序号不用连续，但不要重名。
- 角色/男角色(已不从资源包导入，固定用 Studio 内置模型；下面只是 Unity 里的整理结果，资源包不导出)：`Character/` `Partner/` 里 `rig.fbx` 是骨架，每个部位是 `<部位>.fbx` + 同名 `<部位>.mat`(没有 prefab 时用这种方式)。角色部位名固定 `head body eye brow lash`；男角色 `body head hair eye lash clothes tongue`。
- 外观 `Looks/look_NN/head|body|eye|brow|lash.tga`；look_01 额外带 brow/lash，look_02/03 只换 head/body(其余沿用 look_01)。
- 妆容 `Makeup/makeup_NN.png`：头部 UV 的 RGBA 贴图(和头部贴图同布局，当前 512×512)。第一版 8 个已内置进 Studio(`assets/makeup/`，由 `node tools/build-makeup.mjs` 从这个目录生成，重新生成后需 `node tools/build-studio.mjs`)；之后新增妆容走“导入资源包 / 上传”。**图标：每个妆容旁边放同名加 `_icon` 的图片**(`makeup_01_icon.png`)，导出和导入都会带上；没有图标时自动用妆容的脸部裁图。服装/鞋/发型同理：prefab 旁边同名 png 就是图标，没有时由 Studio 用模型渲染。`Makeup/_icons/` 是旧图标，已不使用。

## 服装 / 鞋 / 发型 旧名 → 新名
| 旧名 | 新名 |
|---|---|
| `casual_dress_010` | `outfit_01` |
| `designer_dress_134` | `outfit_02` |
| `designer_dress_417` | `outfit_03` |
| `designer_dress_424` | `outfit_04` |
| `party_dress_086` | `outfit_05` |
| `party_dress_090` | `outfit_06` |
| `party_dress_179` | `outfit_07` |
| `romantic_dress_021` | `outfit_08` |
| `casual_shoes_004_003` | `shoes_01` |
| `casual_shoes_020_001` | `shoes_02` |
| `designer_shoes_230` | `shoes_03` |
| `designer_shoes_274` | `shoes_04` |
| `designer_shoes_476` | `shoes_05` |
| `glam_shoes_021_003` | `shoes_06` |
| `hair_001` | `hair_01` |
| `hair_002` | `hair_02` |
| `hair_003` | `hair_03` |
| `hair_004` | `hair_04` |
| `hair_005` | `hair_05` |
| `hair_006` | `hair_06` |
| `hair_007` | `hair_07` |

## 动画文件
动画 Clip 的名字是 FBX 里自带的(在 Unity 的 Animation 标签页里定义)，改文件名不会改 Clip 名，Studio 里显示的是 Clip 名。
| 旧文件 | 新文件 |
|---|---|
| `player@standby.FBX` | `idle.fbx` |
| `player@standby02.FBX` | `idle_02.fbx` |
| `player@talk01.FBX` | `talk_01.fbx` |
| `player@talk02.FBX` | `talk_02.fbx` |
| `player@talk03.FBX` | `talk_03.fbx` |
| `player@tops01.FBX` | `pick_tops.fbx` |
| `player@handclap.FBX` | `handclap.fbx` |
| `player@walk.FBX` | `walk.fbx` |
| `player@win.FBX` | `win.fbx` |
| `player@lose.FBX` | `lose.fbx` |
| `boy@Fashion_smile.fbx` | `partner_smile.fbx` |
| `player@message.FBX` | `phone_player_message.fbx` |
| `message@01_10.FBX` | `phone_message_01.fbx` |

