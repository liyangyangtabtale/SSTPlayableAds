using System.Collections.Generic;
using UnityEngine;

namespace SSTPlayable
{
    /// <summary>仅用于无人值守预览动画：由编辑器脚本临时挂到场景里，DebugCapture 读取。</summary>
    public class ClipPreviewData : MonoBehaviour
    {
        public List<AnimationClip> clips = new List<AnimationClip>();
    }
}
