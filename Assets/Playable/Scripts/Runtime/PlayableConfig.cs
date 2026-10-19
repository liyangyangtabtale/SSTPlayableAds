using System;
using System.Collections.Generic;
using UnityEngine;

namespace SSTPlayable
{
    public enum StageType { Outfit, Makeup, Hair, Shoes }

    [Serializable]
    public class TextPair
    {
        public string title;
        [TextArea] public string sub;
    }

    /// <summary>主题：背景、开场短信、结局文案。换主题只需换这一块和素材池。</summary>
    [Serializable]
    public class ThemeConfig
    {
        public string id = "date";
        public Color bgTop = new Color(0.96f, 0.85f, 0.90f);
        public Color bgBottom = new Color(0.91f, 0.71f, 0.82f);
        public Sprite backgroundImage;
        public Sprite endBackgroundImage;
        [Tooltip("换装阶段顶部小标题")] public string title = "MEET MY CRUSH";
        public string introSender = "My Crush";
        [TextArea] public string introMessage = "Tonight? Let's go out!";
        public string tapText = "Tap to start";
        public string confirmText = "Confirm";
        public string cta = "Play Now";
        public TextPair goodEnding = new TextPair { title = "Perfect Date Look!", sub = "Your crush can't take their eyes off you" };
        public TextPair badEnding = new TextPair { title = "Oh no...", sub = "That outfit was a fashion disaster" };
    }

    /// <summary>角色：基础模型 + 头/身材质(贴图)。目前只有一套，之后在控制面板里替换头/身体/眼睛贴图。</summary>
    [Serializable]
    public class CharacterVariant
    {
        public string id = "default";
        [Tooltip("Web 端身体/头部贴图文件名(不含扩展名)，对应 assets/tex/<name>.webp")] public string webBodyTex = "body_101";
        public string webHeadTex = "head_101";
        public Material headMaterial;
        public Material bodyMaterial;
    }

    /// <summary>开场时角色穿的默认外观：若干件默认衣服(控制面板里选一件) + 一个默认发型。选了新衣服/发型后会替换它们。</summary>
    [Serializable]
    public class DefaultLook
    {
        public List<OptionConfig> outfits = new List<OptionConfig>();
        public int outfitIndex;
        public OptionConfig hair;
        public OptionConfig Outfit => outfits.Count > 0 ? outfits[Mathf.Clamp(outfitIndex, 0, outfits.Count - 1)] : null;
    }

    /// <summary>
    /// 结局里的男角色：从屏幕左边走进来，站定后按好/坏结局做反应动画。
    /// 位置是 Unity 世界坐标(相机在 +z 朝 -z，屏幕左边 = +x)；Web 端导出时会自动镜像。
    /// 动画先和女角色共用同一批 clip，之后可以逐个替换。
    /// </summary>
    [Serializable]
    public class PartnerConfig
    {
        public bool enabled = true;
        [Tooltip("只有骨架的 FBX，例如 boy_player02.FBX")] public GameObject rigPrefab;
        [Tooltip("身体/头/头发/衣服/眼睛/睫毛/舌头等蒙皮部件，各带自己的材质")] public List<CharacterDresser.BasePart> parts = new List<CharacterDresser.BasePart>();
        [Tooltip("Web 端部件贴图文件名(assets/partner/<name>.webp)，顺序与 parts 对应，空则不贴图")] public List<string> webTextures = new List<string>();
        [Tooltip("结局男角色的待机动画(循环)，男角色在结局里只播这一个，不再播胜利/失败动画")] public AnimEntry idleAnim;
        [Tooltip("(已不使用)")] public AnimEntry walkAnim, goodAnim, badAnim;
        public Vector3 startPos = new Vector3(3.4f, 0, 0), endPos = new Vector3(0.9f, 0, 0);
        [Min(0.1f)] public float walkSpeed = 1.0f;
        [Tooltip("走路时朝向(欧拉 Y)，-90 = 朝屏幕右边")] public float walkYaw = -90f;
        [Tooltip("站定后朝向，0 = 正对镜头")] public float endYaw = -20f;
        [Header("女主角结局站位：在她原来的位置")]
                [Tooltip("女主角结局朝向角度（自动转向男角色一侧，取绝对值）")] public float girlEndYaw = 20f;
    }

    /// <summary>素材池里的一个选项。服装/鞋/发型用 prefab，妆容用 makeupTexture。</summary>
    [Serializable]
    public class OptionConfig
    {
        public string id;
        [Tooltip("好选择 = 正面结局加分")] public bool good = true;
        public Texture2D icon;
        public GameObject prefab;
        [Tooltip("非空则覆盖 prefab 上所有渲染器的材质")] public Material material;
        [Tooltip("妆容 = 头部材质的 _FacePaintTex，使用头部 UV 布局的 RGBA 贴图")] public Texture2D makeupTexture;
        [Tooltip("非空则覆盖材质的 _MainTex（发型材质原本的贴图引用是断的，运行时按名字赋值）")] public Texture2D mainTexture;
        [Tooltip("发型色相替换颜色(_HueColor)，alpha=0 表示不着色")] public Color tint = new Color(1, 1, 1, 0);
    }

    [Serializable]
    public class StageConfig
    {
        public StageType type;
        public string label;
        [Tooltip("右侧面板顶部页签图标")] public Sprite icon;
        public bool enabled = true;
        [Min(1)] public int columns = 2;
        [Tooltip("本阶段网格里显示的选项数（取素材池前 N 个）")] [Min(1)] public int count = 6;
        public string shotId = "full";
        public List<OptionConfig> options = new List<OptionConfig>();

        public IEnumerable<OptionConfig> VisibleOptions()
        {
            for (int i = 0; i < options.Count && i < count; i++) yield return options[i];
        }
    }

    [Serializable]
    public class CameraShot
    {
        public string id;
        public Vector3 position;
        public Vector3 euler;
        public float fov = 30f;
    }

    [Serializable]
    public class AnimEntry
    {
        public AnimationClip clip;
        public string webName;
        [Tooltip("非循环动画最长播放秒数，0 = 播完整段")] public float maxDuration;
    }

    /// <summary>整个可玩广告的配置入口，相当于"控制面板"。导出为 PlayableWeb/public/config.json。</summary>
    [CreateAssetMenu(menuName = "Playable/Config", fileName = "PlayableConfig")]
    public class PlayableConfig : ScriptableObject
    {
        public ThemeConfig theme = new ThemeConfig();
        public List<CharacterVariant> characters = new List<CharacterVariant>();
        public int characterIndex;
        public DefaultLook defaults = new DefaultLook();
        [Header("结局男角色")] public PartnerConfig partner = new PartnerConfig();
        [Range(0f, 1f)] public float goodThreshold = 0.6f;
        [Tooltip("Tap to start 出现后自动进入换装的延迟(秒)，0 = 只能点击进入")] public float introAutoAdvance = 0f;

        [Header("开场：待机(循环) → 看手机 → 反应 → 回到待机")]
        public AnimEntry idleAnim;
        [Tooltip("收到短信、看手机")] public AnimEntry introAnim;
        [Tooltip("看完短信后的反应")] public AnimEntry introReactAnim;
        [Header("开场手机：和角色的 takePhone / endPhone 同步播放(clip 在手机 FBX 里，如 message@01_10.FBX)")]
        [Tooltip("手机的 takePhone，与 introAnim 同时开始；播放时长沿用 introAnim 的 maxDuration")] public AnimationClip phoneTakeClip;
        [Tooltip("手机的 endPhone，与 introReactAnim 同时开始；播放时长沿用 introReactAnim 的 maxDuration。播完手机隐藏")] public AnimationClip phoneEndClip;
        [Tooltip("开场先待机多久(秒)，然后短信到达")] public float introIdleTime = 1.2f;
        [Header("开场/结局 UI 出现时机(秒)")]
        [Tooltip("开始看手机动画后，等多久显示对话气泡")] public float introBubbleDelay = 1.0f;
        [Tooltip("气泡显示后，等多久显示 Tap to start（此前不可点击开始）")] public float introTapDelay = 1.0f;
        [Tooltip("男角色站定后，等多久显示结局标题/文案")] public float endingUiDelay = 0.3f;
        [Tooltip("结局标题显示后，等多久显示 Play Now 按钮")] public float endingCtaDelay = 1.0f;
        [Header("换装：选对/选错的反馈动画，播完回到待机")]
        public AnimEntry pickGoodAnim;
        public AnimEntry pickBadAnim;
        [Header("结局")]
        [Tooltip("换装结束 → 闪白 → 换结局背景(theme.endBackgroundImage)，两人直接站好。闪白总时长(秒)，0 = 不闪白直接切")] public float endFlashTime = 0.6f;
        public AnimEntry goodAnim;
        public AnimEntry badAnim;

        public List<CameraShot> shots = new List<CameraShot>();
        /// <summary>阶段顺序 = 列表顺序，enabled 控制开关。</summary>
        public List<StageConfig> stages = new List<StageConfig>();

        public CameraShot GetShot(string id)
        {
            foreach (var s in shots) if (s.id == id) return s;
            return shots.Count > 0 ? shots[0] : null;
        }

        public List<StageConfig> ActiveStages()
        {
            var l = new List<StageConfig>();
            foreach (var s in stages) if (s.enabled && s.options.Count > 0) l.Add(s);
            return l;
        }
    }
}
