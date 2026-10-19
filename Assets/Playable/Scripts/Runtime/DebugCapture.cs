using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable
{
    /// <summary>仅在命令行带 -playableCapture 时启用：自动走完流程并把每一步截图存到 -captureDir 目录。用于无人值守验证。</summary>
    public class DebugCapture : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            var args = Environment.GetCommandLineArgs();
            if (Array.IndexOf(args, "-playableCapture") < 0) return;
            string dir = "Captures";
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-captureDir") dir = args[i + 1];
            new GameObject("DebugCapture").AddComponent<DebugCapture>().dir = dir;
        }

        public string dir;
        PlayableGame game; Camera cam; int n;

        IEnumerator Start()
        {
            Directory.CreateDirectory(dir);
            game = FindFirstObjectByType<PlayableGame>();
            cam = Camera.main;
            // overlay 画布不会进 RT，截图时临时改成相机画布
            foreach (var c in FindObjectsByType<Canvas>(FindObjectsSortMode.None))
                if (c.renderMode == RenderMode.ScreenSpaceOverlay) { c.renderMode = RenderMode.ScreenSpaceCamera; c.worldCamera = cam; c.planeDistance = 1f; }

            if (Array.IndexOf(Environment.GetCommandLineArgs(), "-clipPreview") >= 0) { yield return PreviewClips(); yield break; }
            if (Array.IndexOf(Environment.GetCommandLineArgs(), "-bakeIcons") >= 0) { yield return BakeIcons(); yield break; }
            yield return Wait(0.6f); Shot("intro_idle");
            yield return Wait(1.6f); Shot("intro_phone");
            yield return Wait(1.6f); Shot("intro_react");
            yield return Wait(3.0f); Shot("intro_back_idle");
            game.ui.intro.tapArea.onClick.Invoke();
            int stageNo = 0;
            while (game.ui.stage.gameObject.activeInHierarchy || stageNo == 0)
            {
                yield return Wait(1.3f);
                if (!game.ui.stage.gameObject.activeInHierarchy) break;
                Shot("stage" + stageNo + "_a");
                var cells = game.ui.stage.grid.GetComponentsInChildren<OptionCell>();
                cells[stageNo % cells.Length].button.onClick.Invoke();
                yield return Wait(0.8f); Shot("stage" + stageNo + "_b");
                game.ui.stage.confirmButton.onClick.Invoke();
                yield return Wait(0.3f);
                stageNo++;
                if (stageNo > 8) break;
            }
            yield return Wait(1.2f); Shot("ending_walk1"); yield return Wait(1.6f); Shot("ending_walk2"); yield return Wait(1.6f); Shot("ending_react"); yield return Wait(1.8f); Shot("ending_end");
            Quit();
        }

        /// <summary>给没有图标的选项(发型)烘焙头像图标：装上发型 → 头部镜头 → 存 PNG。</summary>
        IEnumerator BakeIcons()
        {
            foreach (var c in FindObjectsByType<Canvas>(FindObjectsSortMode.None)) c.enabled = false;
            cam.backgroundColor = new Color(0.97f, 0.97f, 0.97f);
            cam.clearFlags = CameraClearFlags.SolidColor;
            var shot = new CameraShot { position = new Vector3(0, 1.62f, 1.1f), euler = new Vector3(3, 180, 0), fov = 30 };
            game.cameraRig.Snap(shot);
            game.characterAnimator.Play(game.config.idleAnim, true, null, 0f);
            foreach (var s in game.config.stages)
            {
                if (s.type != StageType.Hair) continue;
                foreach (var o in s.options)
                {
                    game.dresser.Equip(StageType.Hair, o);
                    yield return Wait(0.5f);
                    SaveSquare(o.id);
                }
            }
            // 妆容图标：去掉头发，脸部特写，逐个应用 facepaint 后拍照
            game.dresser.Unequip(StageType.Hair);
            game.cameraRig.Snap(new CameraShot { position = new Vector3(0, 1.6f, 0.72f), euler = new Vector3(3, 180, 0), fov = 30 });
            foreach (var s in game.config.stages)
            {
                if (s.type != StageType.Makeup) continue;
                foreach (var o in s.options)
                {
                    game.dresser.Equip(StageType.Makeup, o);
                    yield return Wait(0.5f);
                    SaveSquare(o.id);
                }
            }
            Quit();
        }

        void SaveSquare(string id)
        {
            const int S = 256;
            var rt = RenderTexture.GetTemporary(S, S, 24);
            var prev = cam.targetTexture; cam.targetTexture = rt; cam.aspect = 1f; cam.Render(); cam.targetTexture = prev;
            RenderTexture.active = rt;
            var tex = new Texture2D(S, S, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, S, S), 0, 0); tex.Apply();
            RenderTexture.active = null; RenderTexture.ReleaseTemporary(rt);
            Directory.CreateDirectory(dir);
            File.WriteAllBytes(Path.Combine(dir, id + ".png"), tex.EncodeToPNG());
            Destroy(tex);
            Debug.Log("[Bake] " + id);
        }

        /// <summary>每个 clip 取 5 个时间点拼成一行，每 6 个 clip 一张图，同时输出名称/时长清单。</summary>
        IEnumerator PreviewClips()
        {
            foreach (var c in FindObjectsByType<Canvas>(FindObjectsSortMode.None)) c.enabled = false;
            var data = FindFirstObjectByType<ClipPreviewData>();
            game.cameraRig.Snap(new CameraShot { position = new Vector3(0, 0.98f, 4.3f), euler = new Vector3(0, 180, 0), fov = 30 });
            const int TW = 120, TH = 213, COLS = 5, ROWS = 6;
            float[] fr = { 0.1f, 0.3f, 0.5f, 0.7f, 0.9f };
            var info = new System.Text.StringBuilder();
            for (int sheetIdx = 0; sheetIdx * ROWS < data.clips.Count; sheetIdx++)
            {
                var sheet = new Texture2D(TW * COLS, TH * ROWS, TextureFormat.RGB24, false);
                for (int r = 0; r < ROWS; r++)
                {
                    int ci = sheetIdx * ROWS + r; if (ci >= data.clips.Count) break;
                    var clip = data.clips[ci];
                    info.AppendLine($"sheet{sheetIdx} row{r}: {clip.name} len={clip.length:0.00}s");
                    for (int c = 0; c < COLS; c++)
                    {
                        game.characterAnimator.Freeze(clip, clip.length * fr[c]);
                        yield return null; yield return null;
                        var rt = RenderTexture.GetTemporary(TW, TH, 24);
                        var prev = cam.targetTexture; cam.targetTexture = rt; cam.aspect = TW / (float)TH; cam.Render(); cam.targetTexture = prev; cam.ResetAspect();
                        RenderTexture.active = rt;
                        sheet.ReadPixels(new Rect(0, 0, TW, TH), c * TW, (ROWS - 1 - r) * TH);
                        RenderTexture.active = null; RenderTexture.ReleaseTemporary(rt);
                    }
                }
                sheet.Apply();
                Directory.CreateDirectory(dir);
                File.WriteAllBytes(Path.Combine(dir, "clips_" + sheetIdx + ".png"), sheet.EncodeToPNG());
                Destroy(sheet);
            }
            File.WriteAllText(Path.Combine(dir, "clips.txt"), info.ToString());
            Quit();
        }

        IEnumerator Wait(float s) { float t = 0; while (t < s) { t += Time.unscaledDeltaTime; yield return null; } }

        void Shot(string name)
        {
            var rt = RenderTexture.GetTemporary(540, 960, 24);
            var prev = cam.targetTexture; cam.targetTexture = rt; cam.Render(); cam.targetTexture = prev;
            RenderTexture.active = rt;
            var tex = new Texture2D(540, 960, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, 540, 960), 0, 0); tex.Apply();
            RenderTexture.active = null; RenderTexture.ReleaseTemporary(rt);
            File.WriteAllBytes(Path.Combine(dir, (n++).ToString("00") + "_" + name + ".png"), tex.EncodeToPNG());
            Destroy(tex);
            Debug.Log("[Capture] " + name);
        }

        static void Quit()
        {
#if UNITY_EDITOR
            UnityEditor.EditorApplication.Exit(0);
#else
            Application.Quit();
#endif
        }
    }
}
