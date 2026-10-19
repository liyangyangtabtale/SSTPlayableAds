using System.IO;
using UnityEditor;
using UnityEngine;

namespace SSTPlayable.Editor
{
    /// <summary>程序化绘制"浴室 + 日落城市窗景"的竖屏背景(1080x1920)。正式美术图到位后，直接替换 ThemeConfig.backgroundImage 即可。</summary>
    public static class BackgroundGenerator
    {
        public const string Path = "Assets/Playable/UI/Backgrounds/date_room.png";
        const int W = 1080, H = 1920;
        static Color32[] px;

        [MenuItem("Playable/UI Sprites/Generate Background")]
        public static Sprite Generate()
        {
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(Path));
            px = new Color32[W * H];
            var rnd = new System.Random(7);
            float Y(float f) => H * (1f - f); // f: 0=顶 → 1=底，转成像素行

            // 墙面：暖桃色竖向渐变 + 左侧柔光
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float t = 1f - y / (float)H; // 顶部 t=1
                    var c = Color.Lerp(new Color(0.93f, 0.62f, 0.60f), new Color(0.99f, 0.80f, 0.72f), 1f - t);
                    float glow = Mathf.Exp(-(Mathf.Pow((x - 120f) / 420f, 2) + Mathf.Pow((y - 900f) / 520f, 2)));
                    c = Color.Lerp(c, new Color(1f, 0.90f, 0.84f), glow * 0.45f);
                    px[y * W + x] = c;
                }

            // 窗：右侧大窗(日落天空 + 城市剪影)
            int wx0 = (int)(W * 0.44f), wx1 = W + 40, wy0 = (int)(H * 0.34f), wy1 = (int)(H * 0.86f); // y 以像素行为准(0=底)
            for (int y = wy0; y < wy1; y++)
                for (int x = wx0; x < Mathf.Min(wx1, W); x++)
                {
                    float t = (y - wy0) / (float)(wy1 - wy0); // 0=窗底(地平线) 1=窗顶
                    Color sky = t < 0.35f ? Color.Lerp(new Color(1f, 0.82f, 0.50f), new Color(0.99f, 0.55f, 0.50f), t / 0.35f)
                                          : Color.Lerp(new Color(0.99f, 0.55f, 0.50f), new Color(0.42f, 0.32f, 0.62f), (t - 0.35f) / 0.65f);
                    float sun = Mathf.Exp(-(Mathf.Pow((x - W * 0.74f) / 150f, 2) + Mathf.Pow((y - (wy0 + 120f)) / 120f, 2)));
                    sky = Color.Lerp(sky, new Color(1f, 0.95f, 0.75f), sun * 0.8f);
                    px[y * W + x] = sky;
                }
            // 城市：三层建筑剪影(远→近渐深)，带点亮的小窗
            Color[] layerCol = { new Color(0.72f, 0.45f, 0.60f), new Color(0.56f, 0.34f, 0.52f), new Color(0.38f, 0.24f, 0.42f) };
            for (int L = 0; L < 3; L++)
            {
                int x = wx0 - 20;
                while (x < W)
                {
                    int bw = 50 + rnd.Next(60), bh = (int)((60 + rnd.Next(190)) * (1f + L * 0.35f));
                    for (int xx = x; xx < Mathf.Min(x + bw, W); xx++)
                        for (int y = wy0; y < Mathf.Min(wy0 + bh, wy1); y++)
                            if (xx >= wx0) px[y * W + xx] = layerCol[L];
                    if (L == 2)
                        for (int wyy = wy0 + 14; wyy < wy0 + bh - 10; wyy += 22)
                            for (int wxx = x + 8; wxx < x + bw - 10; wxx += 16)
                                if (rnd.NextDouble() < 0.28 && wxx >= wx0 && wxx < W - 4) Rect(wxx, wyy, 6, 9, new Color(1f, 0.86f, 0.5f));
                    x += bw + rnd.Next(8);
                }
            }
            // 窗框 + 竖向窗棂
            var frame = new Color(0.90f, 0.52f, 0.52f);
            Rect(wx0 - 14, wy0 - 14, W - wx0 + 28, 14, frame); Rect(wx0 - 14, wy1, W - wx0 + 28, 14, frame); Rect(wx0 - 14, wy0 - 14, 14, wy1 - wy0 + 28, frame);
            foreach (var fx in new[] { 0.64f, 0.82f }) Rect((int)(W * fx) - 6, wy0, 12, wy1 - wy0, frame);
            Rect(wx0, (int)((wy0 + wy1) * 0.5f + 40), W - wx0, 8, new Color(0.9f, 0.52f, 0.52f, 1f));

            // 左侧椭圆镜子：发光环 + 倒映的晚霞
            Ellipse(70, (int)(H * 0.55f), 190, 330, new Color(1f, 0.97f, 0.93f), new Color(0.97f, 0.74f, 0.66f));

            // 台面与柜体
            int cy0 = (int)(H * 0.215f), cy1 = (int)(H * 0.30f);
            Rect(0, cy1, 430, 22, new Color(0.96f, 0.93f, 0.92f));
            Rect(0, cy0, 420, cy1 - cy0, new Color(0.98f, 0.92f, 0.86f));
            Rect(60, cy1 + 22, 150, 26, new Color(0.99f, 0.97f, 0.96f)); // 洗手盆
            Rect(210, cy0 + 20, 8, (cy1 - cy0) - 40, new Color(0.88f, 0.80f, 0.74f));
            Rect(180, cy0 + 70, 24, 6, new Color(0.62f, 0.50f, 0.45f)); Rect(228, cy0 + 70, 24, 6, new Color(0.62f, 0.50f, 0.45f));

            // 地面：粉色水磨石 + 斑点 + 与墙的踢脚线
            int fy1 = (int)(H * 0.215f);
            for (int y = 0; y < fy1; y++)
                for (int x = 0; x < W; x++)
                {
                    float t = y / (float)fy1;
                    var c = Color.Lerp(new Color(0.96f, 0.72f, 0.74f), new Color(0.99f, 0.82f, 0.80f), t);
                    px[y * W + x] = c;
                }
            for (int i = 0; i < 2600; i++)
            {
                int sx = rnd.Next(W), sy = rnd.Next(fy1), sr = 2 + rnd.Next(5);
                var c = rnd.NextDouble() < 0.5 ? new Color(1f, 0.93f, 0.90f) : new Color(0.88f, 0.55f, 0.60f);
                Disc(sx, sy, sr, c, 0.55f);
            }
            Rect(0, fy1, W, 10, new Color(0.88f, 0.60f, 0.62f));
            // 地面反光
            for (int y = 0; y < fy1; y++)
                for (int x = 0; x < W; x++)
                {
                    float g = Mathf.Exp(-Mathf.Pow((x - 720f) / 260f, 2) - Mathf.Pow((y - fy1 * 0.5f) / (fy1 * 0.45f), 2)) * 0.18f;
                    var c = (Color)px[y * W + x]; px[y * W + x] = Color.Lerp(c, Color.white, g);
                }
            // 轻微暗角
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float dx = (x - W / 2f) / (W / 2f), dy = (y - H / 2f) / (H / 2f);
                    float v = 1f - Mathf.Clamp01((dx * dx + dy * dy - 0.55f)) * 0.22f;
                    var c = (Color)px[y * W + x]; px[y * W + x] = new Color(c.r * v, c.g * v, c.b * v, 1f);
                }

            var tex = new Texture2D(W, H, TextureFormat.RGB24, false);
            tex.SetPixels32(px); tex.Apply();
            File.WriteAllBytes(Path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            AssetDatabase.ImportAsset(Path, ImportAssetOptions.ForceUpdate);
            var ti = (TextureImporter)AssetImporter.GetAtPath(Path);
            ti.textureType = TextureImporterType.Sprite; ti.spriteImportMode = SpriteImportMode.Single; ti.mipmapEnabled = false; ti.maxTextureSize = 2048;
            ti.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Sprite>(Path);
        }

        static void Rect(int x, int y, int w, int h, Color c)
        {
            for (int yy = Mathf.Max(0, y); yy < Mathf.Min(H, y + h); yy++)
                for (int xx = Mathf.Max(0, x); xx < Mathf.Min(W, x + w); xx++) px[yy * W + xx] = c;
        }

        static void Disc(int cx, int cy, int r, Color c, float a)
        {
            for (int y = cy - r; y <= cy + r; y++)
                for (int x = cx - r; x <= cx + r; x++)
                {
                    if (x < 0 || y < 0 || x >= W || y >= H) continue;
                    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) px[y * W + x] = Color.Lerp(px[y * W + x], c, a);
                }
        }

        static void Ellipse(int cx, int cy, int rx, int ry, Color ring, Color inner)
        {
            for (int y = cy - ry - 24; y <= cy + ry + 24; y++)
                for (int x = cx - rx - 24; x <= cx + rx + 24; x++)
                {
                    if (x < 0 || y < 0 || x >= W || y >= H) continue;
                    float d = Mathf.Sqrt(Mathf.Pow((x - cx) / (float)rx, 2) + Mathf.Pow((y - cy) / (float)ry, 2));
                    float glow = Mathf.Clamp01(1f - Mathf.Abs(d - 1f) * 7f);
                    if (d <= 0.95f)
                    {
                        float t = (y - (cy - ry)) / (2f * ry);
                        var c = Color.Lerp(new Color(0.99f, 0.62f, 0.55f), new Color(0.62f, 0.42f, 0.62f), t);
                        px[y * W + x] = Color.Lerp(c, inner, 0.25f);
                    }
                    else if (d < 1.06f) px[y * W + x] = ring;
                    else if (glow > 0) px[y * W + x] = Color.Lerp(px[y * W + x], Color.white, glow * 0.5f);
                }
        }
    }
}
