using UnityEditor;

namespace SSTPlayable.Editor
{
    public static class ReimportShaders
    {
        [MenuItem("Playable/Reimport Shaders")]
        public static void Run()
        {
            foreach (var g in AssetDatabase.FindAssets("t:Shader", new[] { "Assets/GenericFramework", "Assets/_Game" }))
                AssetDatabase.ImportAsset(AssetDatabase.GUIDToAssetPath(g), ImportAssetOptions.ForceUpdate);
            AssetDatabase.SaveAssets();
        }
    }
}
