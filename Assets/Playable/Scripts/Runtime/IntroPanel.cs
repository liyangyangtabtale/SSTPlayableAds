using System;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable
{
    /// <summary>开场：只有一个短信气泡（无标题），点击任意处或延迟后进入换装。</summary>
    public class IntroPanel : MonoBehaviour
    {
        public Text sender, message, tap;
        public Button tapArea;
        public GameObject bubble;

        bool showHint;

        public void Show(ThemeConfig t, bool showTapHint, Action onTap)
        {
            gameObject.SetActive(true);
            showHint = showTapHint;
            SetBubbleVisible(false);
            sender.text = t.introSender; sender.gameObject.SetActive(!string.IsNullOrEmpty(t.introSender));
            message.text = t.introMessage;
            tap.text = t.tapText;
            tapArea.onClick.RemoveAllListeners();
            tapArea.onClick.AddListener(() => onTap());
        }
        /// <summary>短信到达时才显示气泡（和提示文字）。</summary>
        public void SetBubbleVisible(bool v)
        {
            bubble.SetActive(v);
            if (!v) tap.gameObject.SetActive(false);
        }
        /// <summary>气泡显示一会后才显示 Tap to start 提示。</summary>
        public void SetTapVisible(bool v) => tap.gameObject.SetActive(v && showHint && !string.IsNullOrEmpty(tap.text));

        public void Hide() => gameObject.SetActive(false);
    }
}
