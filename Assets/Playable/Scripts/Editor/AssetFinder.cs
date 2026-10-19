using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace SSTPlayable.Editor
{
    static class AssetFinder
    {
        /// <summary>按文件名（不含扩展名，忽略大小写）精确查找资源路径，可选限制扩展名。</summary>
        public static string Path(string name, params string[] exts)
        {
            foreach (var g in AssetDatabase.FindAssets(name, new[] { "Assets/_Game" }))
            {
                var p = AssetDatabase.GUIDToAssetPath(g);
                if (!string.Equals(System.IO.Path.GetFileNameWithoutExtension(p), name, System.StringComparison.OrdinalIgnoreCase)) continue;
                if (exts.Length == 0 || exts.Any(e => p.EndsWith(e, System.StringComparison.OrdinalIgnoreCase))) return p;
            }
            return null;
        }

        public static T Load<T>(string name, params string[] exts) where T : Object
        {
            var p = Path(name, exts);
            return p == null ? null : AssetDatabase.LoadAssetAtPath<T>(p);
        }

        public static AnimationClip Clip(string fbxName)
        {
            var p = Path(fbxName, ".fbx");
            if (p == null) return null;
            return AssetDatabase.LoadAllAssetsAtPath(p).OfType<AnimationClip>().FirstOrDefault(c => !c.name.StartsWith("__preview"));
        }
    }
}
