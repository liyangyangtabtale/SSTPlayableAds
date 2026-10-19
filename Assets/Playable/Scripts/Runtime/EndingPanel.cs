using System;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable
{
    public class EndingPanel : MonoBehaviour
    {
        public GameObject card;
        public Text title, sub, ctaLabel;
        public Button ctaButton;
        public Action onCta;
        public void Show(TextPair t, string cta)
        {
            gameObject.SetActive(true);
            title.text = t.title; sub.text = t.sub; ctaLabel.text = cta;
            ctaButton.onClick.RemoveAllListeners();
            ctaButton.onClick.AddListener(() => { Debug.Log("[Playable] CTA clicked"); onCta?.Invoke(); });
            SetTextVisible(false); SetCtaVisible(false);
        }
        /// <summary>结局文案(标题+副标题)和 Play Now 按钮分开显示。</summary>
        public void SetTextVisible(bool v) { card.SetActive(v);}
        public void SetCtaVisible(bool v) => ctaButton.gameObject.SetActive(v);
        public void Hide() => gameObject.SetActive(false);
    }
}
