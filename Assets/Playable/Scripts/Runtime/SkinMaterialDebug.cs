using UnityEngine;

namespace SSTPlayable
{
    /// <summary>调试按键：在原始皮肤材质和 PlayableSkin 材质(Skin_head / Skin_body)之间切换。只在编辑器和 Development Build 里显示。</summary>
    public class SkinMaterialDebug : MonoBehaviour
    {
        public CharacterDresser dresser;
        public Material skinHead, skinBody;
        public bool show = true;

        bool useSkin;

        void OnGUI()
        {
            if (!show || !Debug.isDebugBuild || dresser == null) return;
            float s = Screen.height / 1920f; // 按 1080x1920 参考分辨率缩放
            GUI.matrix = Matrix4x4.Scale(new Vector3(s, s, 1f));
            var style = new GUIStyle(GUI.skin.button) { fontSize = 32 };
            if (GUI.Button(new Rect(20, 20, 380, 90), useSkin ? "皮肤: PlayableSkin" : "皮肤: 原始", style))
            {
                useSkin = !useSkin;
                if (useSkin) dresser.SetSkinOverride(skinHead, skinBody);
                else dresser.SetSkinOverride(null, null);
            }
        }
    }
}
