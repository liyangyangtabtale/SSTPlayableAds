using System;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable
{
    public class OptionCell : MonoBehaviour
    {
        public Button button;
        public RawImage icon;
        public Text label;
        public GameObject selectedFrame;
        public OptionConfig Option { get; private set; }

        public void Bind(OptionConfig o, Action<OptionCell> onClick)
        {
            Option = o;
            icon.texture = o.icon;
            icon.enabled = o.icon != null;
            label.text = o.icon != null ? "" : o.id;
            selectedFrame.SetActive(false);
            button.onClick.RemoveAllListeners();
            button.onClick.AddListener(() => onClick(this));
        }
        public void SetSelected(bool v) => selectedFrame.SetActive(v);
    }
}
