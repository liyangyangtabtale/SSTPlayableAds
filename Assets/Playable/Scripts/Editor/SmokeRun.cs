using UnityEditor;
using UnityEditor.SceneManagement;

namespace SSTPlayable.Editor
{
    public static class SmokeRun
    {
        /// <summary>Unity -batchmode -projectPath . -executeMethod SSTPlayable.Editor.SmokeRun.Run -playableCapture -captureDir out</summary>
        public static void Run()
        {
            EditorSceneManager.OpenScene(SceneBuilder.ScenePath);
            EditorApplication.EnterPlaymode();
        }
    }
}
