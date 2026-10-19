using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable
{
    /// <summary>右侧面板顶部的阶段页签：当前阶段高亮，仅作进度提示，不可点击。</summary>
    public class StageTab : MonoBehaviour
    {
        public Image background, icon;
        public Text label;
        public Color activeBg = new Color(0.98f, 0.55f, 0.72f), idleBg = new Color(1, 1, 1, 0.0f);
        public Color activeFg = Color.white, idleFg = new Color(0.30f, 0.22f, 0.30f);

        public void Bind(StageConfig s, bool active)
        {
            icon.sprite = s.icon;
            icon.enabled = s.icon != null;
            label.text = s.icon != null ? "" : s.label;
            background.color = active ? activeBg : idleBg;
            icon.color = active ? activeFg : idleFg;
            label.color = active ? activeFg : idleFg;
        }
    }
}
