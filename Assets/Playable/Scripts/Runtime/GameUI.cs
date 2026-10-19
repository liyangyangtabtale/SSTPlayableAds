using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable
{
    /// <summary>UI 根：顶部标题横幅 + 开场/换装/结局三个面板。背景在单独的相机画布里。</summary>
    public class GameUI : MonoBehaviour
    {
        public Image background;
        public GameObject titleBanner;
        public Text titleText;
        public IntroPanel intro;
        public StagePanel stage;
        public EndingPanel ending;

        public void ApplyTheme(ThemeConfig t)
        {
            if (background == null) return;
            if (t.backgroundImage != null) { background.sprite = t.backgroundImage; background.color = Color.white; return; }
            const int h = 64;
            var tex = new Texture2D(1, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int y = 0; y < h; y++) tex.SetPixel(0, y, Color.Lerp(t.bgBottom, t.bgTop, y / (h - 1f)));
            tex.Apply();
            background.sprite = Sprite.Create(tex, new Rect(0, 0, 1, h), new Vector2(0.5f, 0.5f));
            background.color = Color.white;
        }

        /// <summary>结局背景：theme.endBackgroundImage 为空则保持原背景。</summary>
        public void ApplyEndBackground(ThemeConfig t)
        {
            if (background == null || t.endBackgroundImage == null) return;
            background.sprite = t.endBackgroundImage; background.color = Color.white;
        }

        Image flash;

        /// <summary>全屏闪白：先淡入变白，白屏时调用 onPeak(在这里切背景/换场景)，再淡出。总时长 duration。</summary>
        public IEnumerator Flash(float duration, Action onPeak)
        {
            if (duration <= 0f) { onPeak?.Invoke(); yield break; }
            if (flash == null)
            {
                var go = new GameObject("Flash", typeof(RectTransform), typeof(Image));
                go.transform.SetParent(transform, false);
                var rt = (RectTransform)go.transform; rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero;
                flash = go.GetComponent<Image>(); flash.raycastTarget = false;
            }
            flash.transform.SetAsLastSibling();
            flash.gameObject.SetActive(true);
            float inT = duration * 0.35f, outT = duration * 0.65f, t = 0;
            while (t < inT) { t += Time.deltaTime; flash.color = new Color(1, 1, 1, Mathf.Clamp01(t / inT)); yield return null; }
            flash.color = Color.white;
            onPeak?.Invoke();
            yield return null;
            for (t = 0; t < outT; t += Time.deltaTime) { flash.color = new Color(1, 1, 1, 1f - Mathf.Clamp01(t / outT)); yield return null; }
            flash.gameObject.SetActive(false);
        }

        /// <summary>null/空 = 隐藏标题横幅。</summary>
        public void SetTitle(string text)
        {
            bool show = !string.IsNullOrEmpty(text);
            titleBanner.SetActive(show);
            if (show) titleText.text = text;
        }

        public void HideAll() { intro.Hide(); stage.Hide(); ending.Hide(); SetTitle(null); }
    }
}
