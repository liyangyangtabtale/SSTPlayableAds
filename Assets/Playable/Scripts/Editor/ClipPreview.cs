using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace SSTPlayable.Editor
{
    public static class ClipPreview
    {
        /// <summary>Unity -batchmode -projectPath . -executeMethod SSTPlayable.Editor.ClipPreview.Run -playableCapture -clipPreview -captureDir out</summary>
        public static void Run()
        {
            EditorSceneManager.OpenScene(SceneBuilder.ScenePath);
            var go = new GameObject("ClipPreviewData");
            var d = go.AddComponent<ClipPreviewData>();
            foreach (var g in AssetDatabase.FindAssets("player@ t:Model", new[] { "Assets/_Game" }))
            {
                var p = AssetDatabase.GUIDToAssetPath(g);
                var c = AssetDatabase.LoadAllAssetsAtPath(p).OfType<AnimationClip>().FirstOrDefault(x => !x.name.StartsWith("__preview"));
                if (c != null) d.clips.Add(c);
            }
            d.clips = d.clips.OrderBy(c => c.name).ToList();
            EditorApplication.EnterPlaymode();
        }
    }
}
