using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable.Editor
{
    /// <summary>
    /// 用代码生成 UI 预设（参考 PPT 第 3 页：顶部标题横幅 + 左侧角色 + 右侧面板[页签+网格]）。
    /// 预设生成后可以直接在 Unity 里手调样式。参考分辨率 1080x1920。
    /// </summary>
    public static class UiPrefabBuilder
    {
        const string Dir = "Assets/Playable/UI/Prefabs/";
        public static readonly Color Pink = new Color(0.96f, 0.40f, 0.64f), PinkSoft = new Color(0.99f, 0.62f, 0.80f), Ink = new Color(0.24f, 0.15f, 0.25f);

        [MenuItem("Playable/2. Build UI Prefabs")]
        public static GameUI Build()
        {
            Directory.CreateDirectory(Dir);
            var cell = SaveCell();
            var tab = SaveTab();
            var intro = SaveIntro();
            var stage = SaveStage(cell, tab);
            var ending = SaveEnding();

            var root = new GameObject("GameUI", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = root.GetComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 10;
            var scaler = root.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight; scaler.matchWidthOrHeight = 0.5f;
            var ui = root.AddComponent<GameUI>();

            // 顶部标题横幅：粉色发光描边 + 白底
            var banner = UiFactory.Rect("TitleBanner", root.transform);
            UiFactory.Anchor(banner, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -34), new Vector2(760, 124));
            var glow = UiFactory.RingImg("Glow", banner, new Color(PinkSoft.r, PinkSoft.g, PinkSoft.b, 0.55f), 1f);
            UiFactory.Stretch(glow.rectTransform, -10, -10, -10, -10);
            var bf = UiFactory.Panel("Fill", banner, new Color(1, 1, 1, 0.94f), 1f); UiFactory.Stretch(bf.rectTransform);
            var br = UiFactory.RingImg("Ring", banner, PinkSoft, 1f); UiFactory.Stretch(br.rectTransform);
            var title = UiFactory.Txt("Title", banner, "TITLE", 58, Ink); UiFactory.Stretch(title.rectTransform, 30, 6, 30, 6);
            ui.titleBanner = banner.gameObject; ui.titleText = title;

            ui.intro = Instance(intro.gameObject, root.transform).GetComponent<IntroPanel>();
            ui.stage = Instance(stage.gameObject, root.transform).GetComponent<StagePanel>();
            ui.ending = Instance(ending.gameObject, root.transform).GetComponent<EndingPanel>();
            ui.stage.cellPrefab = cell; ui.stage.tabPrefab = tab;
            ui.stage.gameObject.SetActive(false); ui.ending.gameObject.SetActive(false);
            var saved = PrefabUtility.SaveAsPrefabAsset(root, Dir + "GameUI.prefab");
            Object.DestroyImmediate(root);
            AssetDatabase.SaveAssets();
            return saved.GetComponent<GameUI>();
        }

        static GameObject Instance(GameObject prefab, Transform parent) => (GameObject)PrefabUtility.InstantiatePrefab(prefab, parent);

        static OptionCell SaveCell()
        {
            var root = new GameObject("OptionCell", typeof(RectTransform));
            var bg = UiFactory.Panel("Bg", root.transform, Color.white, 2.2f); UiFactory.Stretch(bg.rectTransform);
            var btn = root.AddComponent<Button>(); btn.targetGraphic = bg;
            var cs = btn.colors; cs.pressedColor = new Color(0.9f, 0.85f, 0.9f); btn.colors = cs;
            var icon = new GameObject("Icon", typeof(RectTransform), typeof(RawImage)).GetComponent<RawImage>();
            icon.transform.SetParent(root.transform, false); UiFactory.Stretch(icon.rectTransform, 12, 12, 12, 12); icon.raycastTarget = false;
            var label = UiFactory.Txt("Label", root.transform, "", 26, Ink); UiFactory.Stretch(label.rectTransform, 10, 10, 10, 10);
            var sel = UiFactory.RingImg("Selected", root.transform, Pink, 2.2f); UiFactory.Stretch(sel.rectTransform, -3, -3, -3, -3);
            var cell = root.AddComponent<OptionCell>();
            cell.button = btn; cell.icon = icon; cell.label = label; cell.selectedFrame = sel.gameObject;
            var saved = PrefabUtility.SaveAsPrefabAsset(root, Dir + "OptionCell.prefab");
            Object.DestroyImmediate(root);
            return saved.GetComponent<OptionCell>();
        }

        static StageTab SaveTab()
        {
            var root = new GameObject("StageTab", typeof(RectTransform));
            var bg = UiFactory.Panel("Bg", root.transform, Color.white, 2.2f); UiFactory.Stretch(bg.rectTransform);
            var icon = UiFactory.Plain("Icon", root.transform, Ink);
            UiFactory.Anchor(icon.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(58, 58));
            icon.raycastTarget = false;
            var label = UiFactory.Txt("Label", root.transform, "", 22, Ink); UiFactory.Stretch(label.rectTransform, 4, 4, 4, 4);
            var tab = root.AddComponent<StageTab>();
            tab.background = bg; tab.icon = icon; tab.label = label;
            var saved = PrefabUtility.SaveAsPrefabAsset(root, Dir + "StageTab.prefab");
            Object.DestroyImmediate(root);
            return saved.GetComponent<StageTab>();
        }

        static IntroPanel SaveIntro()
        {
            var root = UiFactory.Rect("IntroPanel", null); UiFactory.Stretch(root);
            var tapImg = UiFactory.Plain("TapArea", root, new Color(0, 0, 0, 0)); UiFactory.Stretch(tapImg.rectTransform);
            var tapBtn = tapImg.gameObject.AddComponent<Button>(); tapBtn.targetGraphic = tapImg; tapBtn.transition = Selectable.Transition.None;

            // 短信气泡：左上，尾巴指向角色
            var bubble = UiFactory.Rect("Bubble", root);
            UiFactory.Anchor(bubble, new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(400, -270), new Vector2(430, 240));
            var tailPink = UiFactory.Plain("TailRing", bubble, PinkSoft); tailPink.sprite = UiFactory.Tail; tailPink.raycastTarget = false;
            UiFactory.Anchor(tailPink.rectTransform, new Vector2(0.12f, 0), new Vector2(0.12f, 0), new Vector2(0.5f, 1), new Vector2(0, 6), new Vector2(58, 44));
            var fill = UiFactory.Panel("Fill", bubble, Color.white, 1.4f); UiFactory.Stretch(fill.rectTransform);
            var ring = UiFactory.RingImg("Ring", bubble, PinkSoft, 1.4f); UiFactory.Stretch(ring.rectTransform);
            var tailWhite = UiFactory.Plain("Tail", bubble, Color.white); tailWhite.sprite = UiFactory.Tail; tailWhite.raycastTarget = false;
            UiFactory.Anchor(tailWhite.rectTransform, new Vector2(0.12f, 0), new Vector2(0.12f, 0), new Vector2(0.5f, 1), new Vector2(0, 8), new Vector2(44, 32));
            var sender = UiFactory.Txt("Sender", bubble, "Sender", 32, Pink, TextAnchor.UpperLeft);
            UiFactory.Anchor(sender.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -20), new Vector2(-56, 44));
            var msg = UiFactory.Txt("Message", bubble, "Message", 44, Ink, TextAnchor.UpperLeft);
            UiFactory.Anchor(msg.rectTransform, new Vector2(0, 0), new Vector2(1, 1), new Vector2(0.5f, 0.5f), new Vector2(0, -26), new Vector2(-56, -110));
            var tap = UiFactory.Txt("Tap", root, "Tap to start", 44, Pink);
            UiFactory.Anchor(tap.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 150), new Vector2(700, 80));
            var p = root.gameObject.AddComponent<IntroPanel>();
            p.sender = sender; p.message = msg; p.tap = tap; p.tapArea = tapBtn; p.bubble = bubble.gameObject;
            var saved = PrefabUtility.SaveAsPrefabAsset(root.gameObject, Dir + "IntroPanel.prefab");
            Object.DestroyImmediate(root.gameObject);
            return saved.GetComponent<IntroPanel>();
        }

        static StagePanel SaveStage(OptionCell cell, StageTab tab)
        {
            var root = UiFactory.Rect("StagePanel", null); UiFactory.Stretch(root);

            // 右侧圆角面板（高度由 StagePanel.Show 按行数计算）
            var panelImg = UiFactory.Panel("Panel", root, new Color(1f, 0.97f, 0.98f, 0.90f), 1.1f);
            var panel = panelImg.rectTransform;
            UiFactory.Anchor(panel, new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-30, -250), new Vector2(480, 900));
            var pr = UiFactory.RingImg("Ring", panel, new Color(1, 1, 1, 0.9f), 1.1f); UiFactory.Stretch(pr.rectTransform);

            var tabRow = UiFactory.Rect("TabRow", panel);
            UiFactory.Anchor(tabRow, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -16), new Vector2(0, 96));
            var h = tabRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.padding = new RectOffset(16, 16, 0, 0); h.spacing = 10; h.childControlWidth = true; h.childControlHeight = true;
            h.childForceExpandWidth = true; h.childForceExpandHeight = true;

            var grid = UiFactory.Rect("Grid", panel);
            UiFactory.Anchor(grid, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -130), new Vector2(-32, 780));
            var g = grid.gameObject.AddComponent<GridLayoutGroup>();
            g.cellSize = new Vector2(212, 250); g.spacing = new Vector2(14, 14);
            g.startCorner = GridLayoutGroup.Corner.UpperLeft; g.childAlignment = TextAnchor.UpperCenter;
            g.constraint = GridLayoutGroup.Constraint.FixedColumnCount; g.constraintCount = 2;

            // 确认按钮：面板正下方
            var confirm = UiFactory.PillButton("ConfirmButton", panel, "Confirm", Pink, 54, out var confirmLabel);
            UiFactory.Anchor((RectTransform)confirm.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -36), new Vector2(420, 120));

            var p = root.gameObject.AddComponent<StagePanel>();
            p.panel = panel; p.tabRow = tabRow; p.grid = grid; p.gridLayout = g;
            p.cellPrefab = cell; p.tabPrefab = tab; p.confirmButton = confirm; p.confirmLabel = confirmLabel;
            var saved = PrefabUtility.SaveAsPrefabAsset(root.gameObject, Dir + "StagePanel.prefab");
            Object.DestroyImmediate(root.gameObject);
            return saved.GetComponent<StagePanel>();
        }

        static EndingPanel SaveEnding()
        {
            var root = UiFactory.Rect("EndingPanel", null); UiFactory.Stretch(root);
            var card = UiFactory.Rect("Card", root);
            UiFactory.Anchor(card, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -60), new Vector2(880, 300));
            var glow = UiFactory.RingImg("Glow", card, new Color(PinkSoft.r, PinkSoft.g, PinkSoft.b, 0.55f), 1f); UiFactory.Stretch(glow.rectTransform, -10, -10, -10, -10);
            var fill = UiFactory.Panel("Fill", card, new Color(1, 1, 1, 0.95f), 1f); UiFactory.Stretch(fill.rectTransform);
            var ring = UiFactory.RingImg("Ring", card, PinkSoft, 1f); UiFactory.Stretch(ring.rectTransform);
            var title = UiFactory.Txt("Title", card, "Title", 70, Pink);
            UiFactory.Anchor(title.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -28), new Vector2(-60, 120));
            var sub = UiFactory.Txt("Sub", card, "Sub", 42, Ink, TextAnchor.MiddleCenter, FontStyle.Normal);
            UiFactory.Anchor(sub.rectTransform, new Vector2(0, 0), new Vector2(1, 0), new Vector2(0.5f, 0), new Vector2(0, 28), new Vector2(-80, 130));
            var cta = UiFactory.PillButton("CtaButton", root, "Play Now", Pink, 62, out var ctaLabel);
            UiFactory.Anchor((RectTransform)cta.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 70), new Vector2(760, 132));
            var p = root.gameObject.AddComponent<EndingPanel>();
            p.title = title; p.sub = sub; p.ctaButton = cta; p.ctaLabel = ctaLabel;
            var saved = PrefabUtility.SaveAsPrefabAsset(root.gameObject, Dir + "EndingPanel.prefab");
            Object.DestroyImmediate(root.gameObject);
            return saved.GetComponent<EndingPanel>();
        }
    }
}
