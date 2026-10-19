using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable.Editor
{
    static class UiFactory
    {
        public static Sprite Fill => UiSpriteGenerator.Load(UiSpriteGenerator.Fill);
        public static Sprite Ring => UiSpriteGenerator.Load(UiSpriteGenerator.Ring);
        public static Sprite Tail => UiSpriteGenerator.Load(UiSpriteGenerator.Tail);
        public static Font Font => Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        public static RectTransform Rect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static void Stretch(RectTransform r, float l = 0, float b = 0, float rr = 0, float t = 0)
        {
            r.anchorMin = Vector2.zero; r.anchorMax = Vector2.one;
            r.offsetMin = new Vector2(l, b); r.offsetMax = new Vector2(-rr, -t);
        }

        public static void Anchor(RectTransform r, Vector2 min, Vector2 max, Vector2 pivot, Vector2 pos, Vector2 size)
        {
            r.anchorMin = min; r.anchorMax = max; r.pivot = pivot; r.anchoredPosition = pos; r.sizeDelta = size;
        }

        /// <summary>圆角填充块。corner = 圆角缩放：值越大圆角越小（pixelsPerUnitMultiplier）。</summary>
        public static Image Panel(string name, Transform parent, Color c, float corner = 1.5f)
        {
            var i = Rect(name, parent).gameObject.AddComponent<Image>();
            i.sprite = Fill; i.type = Image.Type.Sliced; i.color = c; i.pixelsPerUnitMultiplier = corner;
            return i;
        }

        /// <summary>圆角描边（中间透明）。</summary>
        public static Image RingImg(string name, Transform parent, Color c, float corner = 1.5f)
        {
            var i = Rect(name, parent).gameObject.AddComponent<Image>();
            i.sprite = Ring; i.type = Image.Type.Sliced; i.color = c; i.pixelsPerUnitMultiplier = corner; i.raycastTarget = false;
            return i;
        }

        public static Image Plain(string name, Transform parent, Color c)
        {
            var i = Rect(name, parent).gameObject.AddComponent<Image>();
            i.color = c;
            return i;
        }

        public static Text Txt(string name, Transform parent, string s, int size, Color c, TextAnchor a = TextAnchor.MiddleCenter, FontStyle st = FontStyle.Bold)
        {
            var t = Rect(name, parent).gameObject.AddComponent<Text>();
            t.font = Font; t.text = s; t.fontSize = size; t.color = c; t.alignment = a; t.fontStyle = st;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Truncate;
            t.raycastTarget = false;
            t.resizeTextForBestFit = true; t.resizeTextMinSize = size / 2; t.resizeTextMaxSize = size;
            return t;
        }

        /// <summary>主按钮：白底图 + Button 颜色着色，禁用时变灰。</summary>
        public static Button PillButton(string name, Transform parent, string label, Color normal, int fontSize, out Text text)
        {
            var img = Panel(name, parent, Color.white, 1f);
            var b = img.gameObject.AddComponent<Button>(); b.targetGraphic = img;
            var cs = b.colors;
            cs.normalColor = normal; cs.highlightedColor = normal; cs.selectedColor = normal;
            cs.pressedColor = normal * 0.82f; cs.disabledColor = new Color(0.80f, 0.76f, 0.80f, 1f);
            b.colors = cs;
            text = Txt("Label", img.transform, label, fontSize, Color.white);
            Stretch(text.rectTransform, 10, 0, 10, 0);
            return b;
        }
    }
}
