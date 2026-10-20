using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace SSTPlayable.Editor
{
    public static class SceneBuilder
    {
        public const string ScenePath = "Assets/Playable/Scenes/Main.unity";

        [MenuItem("Playable/3. Build Main Scene")]
        public static void Build()
        {
            var cfg = AssetDatabase.LoadAssetAtPath<PlayableConfig>(DefaultConfigBuilder.ConfigPath) ?? DefaultConfigBuilder.Create();
            var uiPrefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Playable/UI/Prefabs/GameUI.prefab");
            if (uiPrefab == null) uiPrefab = UiPrefabBuilder.Build().gameObject;

            Directory.CreateDirectory("Assets/Playable/Scenes");
            AssetDatabase.DeleteAsset("Assets/Playable/Scenes/FootShadow.mat");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var camGo = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener)) { tag = "MainCamera" };
            var cam = camGo.GetComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = new Color(0.96f, 0.85f, 0.9f);
            cam.nearClipPlane = 0.1f; cam.farClipPlane = 200f; cam.fieldOfView = 30f;
            var rig = camGo.AddComponent<CameraRig>(); rig.cam = cam;

            var lightGo = new GameObject("Directional Light", typeof(Light));
            var light = lightGo.GetComponent<Light>(); light.type = LightType.Directional; light.intensity = 0.85f; light.shadows = LightShadows.None;
            lightGo.transform.rotation = Quaternion.Euler(35, 160, 0);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat; RenderSettings.ambientLight = new Color(0.45f, 0.43f, 0.47f);

            // 背景：独立的 ScreenSpaceCamera 画布，渲染在角色之后
            var bgCanvasGo = new GameObject("BackgroundCanvas", typeof(Canvas), typeof(CanvasScaler));
            var bgCanvas = bgCanvasGo.GetComponent<Canvas>(); bgCanvas.renderMode = RenderMode.ScreenSpaceCamera; bgCanvas.worldCamera = cam; bgCanvas.planeDistance = 150;
            var bg = UiFactory.Plain("Background", bgCanvasGo.transform, Color.white);
            UiFactory.Anchor(bg.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1080, 1920));
            var fitter = bg.gameObject.AddComponent<UnityEngine.UI.AspectRatioFitter>(); fitter.aspectMode = UnityEngine.UI.AspectRatioFitter.AspectMode.EnvelopeParent; fitter.aspectRatio = 1080f / 1920f;

            // 脚下阴影
            var shadow = GameObject.CreatePrimitive(PrimitiveType.Quad); shadow.name = "FootShadow";
            Object.DestroyImmediate(shadow.GetComponent<Collider>());
            shadow.transform.SetPositionAndRotation(new Vector3(0, 0.01f, 0), Quaternion.Euler(90, 0, 0)); shadow.transform.localScale = new Vector3(1.1f, 0.7f, 1f);
            var sm = new Material(Shader.Find("Sprites/Default")) { color = new Color(0.2f, 0.05f, 0.1f, 0.45f) };
            sm.mainTexture = UiSpriteGenerator.Load(UiSpriteGenerator.Shadow).texture;
            AssetDatabase.CreateAsset(sm, "Assets/Playable/Scenes/FootShadow.mat");
            shadow.GetComponent<MeshRenderer>().sharedMaterial = sm;

            // 角色
            var charGo = new GameObject("Character", typeof(CharacterDresser), typeof(CharacterAnimator), typeof(CharacterDragRotate));
            var dresser = charGo.GetComponent<CharacterDresser>();
            dresser.rigPrefab = AssetFinder.Load<GameObject>("player", ".fbx");
            dresser.baseParts.Add(Part("head", "head", head: true));
            dresser.baseParts.Add(Part("body", "body", body: true));
            dresser.baseParts.Add(Part("eyeball", "eyeball"));
            dresser.baseParts.Add(Part("eyelash", "eyelash", tex: "eyelash"));
            dresser.baseParts.Add(Part("eyebrow", "eyebrow"));
            var skinDebug = charGo.AddComponent<SkinMaterialDebug>(); skinDebug.dresser = dresser;
            skinDebug.skinHead = AssetDatabase.LoadAssetAtPath<Material>("Assets/PlayableSkin/Skin_head.mat");
            skinDebug.skinBody = AssetDatabase.LoadAssetAtPath<Material>("Assets/PlayableSkin/Skin_body.mat");

            var uiGo = (GameObject)PrefabUtility.InstantiatePrefab(uiPrefab);
            var ui = uiGo.GetComponent<GameUI>(); ui.background = bg;

            var gameGo = new GameObject("PlayableGame", typeof(PlayableGame));
            var game = gameGo.GetComponent<PlayableGame>();
            game.config = cfg; game.dresser = dresser; game.characterAnimator = charGo.GetComponent<CharacterAnimator>(); game.cameraRig = rig; game.ui = ui;

            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            rig.Snap(cfg.GetShot("intro"));
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
        }

        static CharacterDresser.BasePart Part(string fbx, string mat, bool head = false, bool body = false, string tex = null) =>
            new CharacterDresser.BasePart
            {
                prefab = AssetFinder.Load<GameObject>(fbx, ".fbx"),
                material = AssetFinder.Load<Material>(mat, ".mat"),
                mainTexture = tex == null ? null : AssetFinder.Load<Texture2D>(tex, ".tga"),
                isHead = head, isBody = body
            };

        /// <summary>
        /// 命令行：Unity -batchmode -executeMethod SSTPlayable.Editor.SceneBuilder.BuildAll
        /// 日常构建：**已有配置就保留**(你在 Inspector 里改过的不会被覆盖)，只重做 UI 预设/场景/导出，并检查资源引用。
        /// </summary>
        public static void BuildAll()
        {
            UiSpriteGenerator.Generate();
            foreach (var n in new[] { "outfit", "makeup", "hair", "shoes" }) UiSpriteGenerator.ConfigureIcon(UiSpriteGenerator.Dir + "icon_" + n + ".png");
            if (AssetDatabase.LoadAssetAtPath<PlayableConfig>(DefaultConfigBuilder.ConfigPath) == null) DefaultConfigBuilder.Create();
            UiPrefabBuilder.Build();
            Build();
            ConfigValidator.Run();
            ConfigExporter.Export();
        }

        /// <summary>命令行：重新扫描资源生成默认配置(会覆盖现有配置)，再构建。资源位置/名字变了用这个。</summary>
        public static void ResetAndBuildAll()
        {
            DefaultConfigBuilder.Create();
            BuildAll();
        }
    }
}
