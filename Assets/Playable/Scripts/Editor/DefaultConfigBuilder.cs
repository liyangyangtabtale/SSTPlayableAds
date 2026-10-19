using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace SSTPlayable.Editor
{
    /// <summary>
    /// 生成默认配置：1 个主题(约会) × 1 个角色 × 4 阶段。服装/鞋/发型**自动扫描** Role/role 下现有的资源(不再硬编码名字)，
    /// 资源位置/名字变了重新运行即可。运行会重置现有配置——日常构建(BuildAll)不会覆盖你已经改过的配置。
    /// </summary>
    public static class DefaultConfigBuilder
    {
        public const string ConfigPath = "Assets/Playable/Config/PlayableConfig.asset";

        [MenuItem("Playable/1. Create Default Config (重置现有配置)")]
        public static PlayableConfig Create()
        {
            Directory.CreateDirectory("Assets/Playable/Config");
            var cfg = AssetDatabase.LoadAssetAtPath<PlayableConfig>(ConfigPath);
            if (cfg == null) { cfg = ScriptableObject.CreateInstance<PlayableConfig>(); AssetDatabase.CreateAsset(cfg, ConfigPath); }
            cfg.theme = new ThemeConfig();
            cfg.characters.Clear();
            cfg.characters.Add(new CharacterVariant
            {
                id = "default", webBodyTex = "body_101", webHeadTex = "head_101",
                headMaterial = AssetFinder.Load<Material>("head_color_101", ".mat"),
                bodyMaterial = AssetFinder.Load<Material>("body_color_101", ".mat"),
            });
            cfg.characterIndex = 0;
            // 默认外观：先都用 001（之后可以改名/增加默认衣服，控制面板里选用哪一件）
            var dressFolders = ItemFolders("dress");
            cfg.defaults = new DefaultLook { outfitIndex = 0, hair = MakeOption(StageType.Hair, "hair_001", true) };
            foreach (var f in dressFolders.Take(2)) cfg.defaults.outfits.Add(MakeFolderOption(f, true));
            cfg.theme.backgroundImage = AssetDatabase.LoadAssetAtPath<Sprite>(BackgroundGenerator.Path) ?? BackgroundGenerator.Generate(); // 已有背景图(含你替换的正式美术)不会被覆盖
            cfg.goodThreshold = 0.6f; cfg.introAutoAdvance = 0f;

            cfg.idleAnim = Anim("player@standby02", "standby2");
            cfg.introAnim = Anim("player@message", "message");
            cfg.introAnim.maxDuration = 6f; // 原 clip 25.8 秒，开场只取前 6 秒          // 看手机
            cfg.introReactAnim = Anim("player@game_pose02", "game_pose02"); // 双手举起，兴奋
            cfg.introIdleTime = 1.2f;
            cfg.pickGoodAnim = Anim("player@handclap", "clap");        // 选对：鼓掌
            cfg.pickBadAnim = Anim("player@no", "no");                 // 选错：摆手否定
            cfg.goodAnim = Anim("player@win", "win");
            cfg.badAnim = Anim("player@lose", "lose");

            // 相机镜头：角色偏左(屏幕 x≈0.29)，右侧留给面板。位置/角度进场景后可微调，再存回 asset。
            cfg.shots.Clear();
            cfg.shots.Add(Shot("intro", -0.27f, 0.98f, 4.3f));
            cfg.shots.Add(Shot("full", -0.27f, 0.98f, 4.3f));
            cfg.shots.Add(Shot("ending", -0.37f, 1.25f, 5.8f)); // 女角色屏幕位置与换装时一致(偏左 29%)，右边留给走进来的男角色

            // 结局男角色 boy_player02：骨架 + 7 个蒙皮部件(材质/贴图用资源里自带的 boy_*.mat)。动画先和女角色一样
            cfg.partner = new PartnerConfig
            {
                enabled = true,
                rigPrefab = AssetFinder.Load<GameObject>("boy_player02", ".fbx"),
                walkAnim = Anim("player@walk", "walk"), goodAnim = Anim("player@win", "win"), badAnim = Anim("player@lose", "lose"),
                // 男角色从屏幕右侧进来(相机在 +z 朝 -z，屏幕右 = -x)，走到女角色右边；女角色位置不动
                startPos = new Vector3(-3.4f, 0, 0), endPos = new Vector3(-0.85f, 0, 0), walkYaw = 90f, endYaw = 20f,
            };
            foreach (var n in new[] { "body", "head", "hair", "clothes", "eyeball", "eyelash", "she" })
            {
                cfg.partner.parts.Add(new CharacterDresser.BasePart
                {
                    prefab = AssetFinder.Load<GameObject>("boy_" + n, ".fbx"),
                    material = AssetFinder.Load<Material>("boy_" + n, ".mat"),
                });
                cfg.partner.webTextures.Add(n == "she" ? "boy_head" : "boy_" + n); // 舌头(she)用头部贴图的图集
            }
            if (cfg.partner.rigPrefab == null) Debug.LogWarning("[Playable] 找不到 boy_player02.FBX");

            cfg.stages.Clear();
            cfg.stages.Add(FolderStage(StageType.Outfit, "Outfit", "dress"));
            cfg.stages.Add(Stage(StageType.Makeup, "Makeup", "full", cfg,
                new[] { "facepaint_001", "facepaint_002", "facepaint_003", "facepaint_004", "facepaint_005", "facepaint_006" },
                new[] { true, true, true, false, false, false }));
            cfg.stages.Add(HairStage());
            cfg.stages.Add(FolderStage(StageType.Shoes, "Shoes", "shoes"));

            EditorUtility.SetDirty(cfg);
            AssetDatabase.SaveAssets();
            return cfg;
        }

        static CameraShot Shot(string id, float x, float y, float dist) =>
            new CameraShot { id = id, position = new Vector3(x, y, dist), euler = new Vector3(0, 180, 0), fov = 30 };

        static AnimEntry Anim(string fbx, string web)
        {
            var clip = AssetFinder.Clip(fbx);
            if (clip == null) Debug.LogWarning("[Playable] 找不到动画 " + fbx);
            return new AnimEntry { clip = clip, webName = web };
        }

        static readonly bool[] GoodPattern = { true, true, true, false, false, true, true, false };

        /// <summary>在 Assets/_Game 下找名为 name、且上一级目录叫 role 的目录(服装 dress / 鞋 shoes / 发型 hair)，返回其子文件夹(按名字排序)。</summary>
        static List<string> ItemFolders(string name)
        {
            foreach (var d in Directory.GetDirectories("Assets/_Game", name, SearchOption.AllDirectories))
                if (Path.GetFileName(Path.GetDirectoryName(d)) == "role")
                    return Directory.GetDirectories(d).Select(x => x.Replace('\\', '/')).OrderBy(x => x).ToList();
            Debug.LogWarning("[Playable] 找不到资源目录 role/" + name);
            return new List<string>();
        }

        static string FirstFile(string folder, params string[] exts) =>
            Directory.GetFiles(folder).Where(f => !f.EndsWith(".meta") && exts.Any(e => f.EndsWith(e, System.StringComparison.OrdinalIgnoreCase)))
                     .OrderBy(f => f).Select(f => f.Replace('\\', '/')).FirstOrDefault();

        /// <summary>从一个服装/鞋文件夹组装选项：文件夹里的 prefab(没有则 FBX)、第一个材质、第一张 png 图标。id = prefab 名字。</summary>
        static OptionConfig MakeFolderOption(string folder, bool good)
        {
            var prefabPath = FirstFile(folder, ".prefab") ?? FirstFile(folder, ".fbx");
            var o = new OptionConfig { good = good, id = Path.GetFileNameWithoutExtension(prefabPath ?? folder) };
            if (prefabPath != null) o.prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
            var mat = FirstFile(folder, ".mat"); if (mat != null) o.material = AssetDatabase.LoadAssetAtPath<Material>(mat);
            var png = FirstFile(folder, ".png"); if (png != null) o.icon = AssetDatabase.LoadAssetAtPath<Texture2D>(png);
            if (o.prefab == null) Debug.LogWarning("[Playable] 文件夹里没有 prefab/FBX: " + folder);
            return o;
        }

        static StageConfig FolderStage(StageType type, string label, string dir)
        {
            var s = NewStage(type, label);
            var folders = ItemFolders(dir);
            for (int i = 0; i < folders.Count; i++) s.options.Add(MakeFolderOption(folders[i], GoodPattern[i % GoodPattern.Length]));
            return s;
        }

        static StageConfig HairStage()
        {
            var s = NewStage(StageType.Hair, "Hair");
            var ids = Directory.GetFiles("Assets/_Game", "hair_*.prefab", SearchOption.AllDirectories).Select(f => Path.GetFileNameWithoutExtension(f)).Distinct().OrderBy(x => x).ToList();
            for (int i = 0; i < ids.Count; i++) s.options.Add(MakeOption(StageType.Hair, ids[i], GoodPattern[(i + 3) % GoodPattern.Length]));
            return s;
        }

        static StageConfig NewStage(StageType type, string label)
        {
            var s = new StageConfig { type = type, label = label, shotId = "full", columns = 2, count = 6 };
            s.icon = UiSpriteGenerator.Load(UiSpriteGenerator.Dir + "icon_" + type.ToString().ToLower() + ".png");
            return s;
        }

        /// <summary>按类型从资源里组装一个选项(服装/鞋/发型用模型，妆容用头部 UV 的 facepaint 贴图)。</summary>
        static OptionConfig MakeOption(StageType type, string id, bool good)
        {
            var o = new OptionConfig { id = id, good = good };
            switch (type)
            {
                case StageType.Outfit:
                    o.prefab = AssetFinder.Load<GameObject>(id, ".prefab");
                    o.material = AssetFinder.Load<Material>(id + "_color_001", ".mat");
                    o.icon = AssetFinder.Load<Texture2D>(id + "_001", ".png");
                    break;
                case StageType.Shoes:
                    o.prefab = AssetFinder.Load<GameObject>(id, ".fbx");
                    o.material = AssetFinder.Load<Material>(id + "_color_001", ".mat");
                    o.icon = AssetFinder.Load<Texture2D>(id + "_001", ".png");
                    break;
                case StageType.Hair:
                    o.prefab = AssetFinder.Load<GameObject>(id, ".prefab");
                    o.mainTexture = AssetFinder.Load<Texture2D>(id, ".tga");
                    o.material = AssetFinder.Load<Material>(id + "_color_001", ".mat");
                    o.icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Playable/UI/Icons/" + id + ".png"); // 由 -bakeIcons 烘焙
                    break;
                case StageType.Makeup:
                    o.makeupTexture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Playable/Makeup/" + id + ".png");
                    o.icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Playable/UI/Icons/" + id + ".png") // 由 -bakeIcons 烘焙的 3D 脸部图标
                        ?? AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Playable/Makeup/" + id + "_icon.png"); // 占位：平面 UV 图标
                    break;
            }
            if (o.prefab == null && type != StageType.Makeup) Debug.LogWarning("[Playable] 缺少 prefab: " + id);
            if (type == StageType.Makeup && o.makeupTexture == null) Debug.LogWarning("[Playable] 缺少 facepaint 贴图: " + id);
            return o;
        }

        static StageConfig Stage(StageType type, string label, string shot, PlayableConfig cfg, string[] ids, bool[] good)
        {
            var s = new StageConfig { type = type, label = label, shotId = shot, columns = 2, count = 6 };
            s.icon = UiSpriteGenerator.Load(UiSpriteGenerator.Dir + "icon_" + type.ToString().ToLower() + ".png");
            for (int i = 0; i < ids.Length; i++) s.options.Add(MakeOption(type, ids[i], good[i]));
            return s;
        }
    }
}
