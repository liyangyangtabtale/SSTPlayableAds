using System.IO;
using UnityEditor;
using UnityEngine;

namespace SSTPlayable.Editor
{
    /// <summary>程序化生成 UI 用的圆角精灵（填充/描边/小三角/脚下阴影），保证九宫格边缘抗锯齿。</summary>
    public static class UiSpriteGenerator
    {
        public const string Dir = "Assets/Playable/UI/Sprites/";
        public static string Fill = Dir + "round_fill.png", Ring = Dir + "round_ring.png", Tail = Dir + "tail.png", Shadow = Dir + "shadow.png";

        [MenuItem("Playable/UI Sprites/Generate")]
        public static void Generate()
        {
            Directory.CreateDirectory(Dir);
            const int S = 128, R = 48, RING = 8;
            Save(Fill, S, S, (x, y) => Round(x, y, S, R), border: R);
            Save(Ring, S, S, (x, y) => Mathf.Clamp01(Round(x, y, S, R) - Round(x, y, S, R, RING)), border: R);
            Save(Tail, 64, 48, (x, y) =>
            {   // 向下的三角，顶边在 y=47
                float w = (y / 47f) * 32f;   // y 越小越靠下尖端
                float dx = Mathf.Abs(x - 31.5f);
                return Mathf.Clamp01(w - dx + 0.5f);
            }, border: 0);
            Save(Shadow, 128, 128, (x, y) =>
            {
                float dx = (x - 63.5f) / 63.5f, dy = (y - 63.5f) / 63.5f;
                float d = Mathf.Sqrt(dx * dx + dy * dy);
                return Mathf.Clamp01(1f - d) * Mathf.Clamp01(1f - d) * 0.9f;
            }, border: 0);
            AssetDatabase.Refresh();
        }

        static float Round(float x, float y, int s, float r, float inset = 0)
        {
            float cx = s * 0.5f, cy = s * 0.5f, half = s * 0.5f - inset - 0.5f;
            float qx = Mathf.Abs(x - cx + 0.5f) - (half - (r - inset));
            float qy = Mathf.Abs(y - cy + 0.5f) - (half - (r - inset));
            float rr = Mathf.Max(0.01f, r - inset);
            float outside = new Vector2(Mathf.Max(qx, 0), Mathf.Max(qy, 0)).magnitude;
            float d = outside + Mathf.Min(Mathf.Max(qx, qy), 0) - rr;
            return Mathf.Clamp01(0.5f - d);
        }

        static void Save(string path, int w, int h, System.Func<int, int, float> alpha, int border)
        {
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                    px[y * w + x] = new Color(1, 1, 1, alpha(x, y));
            tex.SetPixels32(px); tex.Apply();
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            var ti = (TextureImporter)AssetImporter.GetAtPath(path);
            ti.textureType = TextureImporterType.Sprite;
            ti.spriteImportMode = SpriteImportMode.Single;
            ti.alphaIsTransparency = true; ti.mipmapEnabled = false;
            ti.spriteBorder = new Vector4(border, border, border, border);
            ti.spritePixelsPerUnit = 100;
            ti.SaveAndReimport();
        }

        public static Sprite Load(string path) => AssetDatabase.LoadAssetAtPath<Sprite>(path);

        /// <summary>导入 tools/make_icons 生成的页签图标 PNG（白色线条，运行时着色）。</summary>
        public static void ConfigureIcon(string path)
        {
            var ti = AssetImporter.GetAtPath(path) as TextureImporter;
            if (ti == null) return;
            ti.textureType = TextureImporterType.Sprite; ti.spriteImportMode = SpriteImportMode.Single; ti.alphaIsTransparency = true; ti.mipmapEnabled = false;
            ti.SaveAndReimport();
        }
    }
}
