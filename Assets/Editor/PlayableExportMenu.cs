// 放在 Assets/Editor/ 下，菜单里会出现 Playable/…(源文件在 PlayableStudio/unity-editor/，改了请两边同步)
// 它只做两件事：创建美术放资源的目录约定；调用 PlayableStudio 里的导出工具把资源导成 Studio 能导入的资源包(ZIP)。导出工具只读 Unity 工程，不修改任何资源。
#if UNITY_EDITOR
using System.Diagnostics;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class PlayableExportMenu
{
    const string Root = "Assets/PlayableExport";
    static readonly string[] Folders = { "Looks", "Outfits", "Hair", "Shoes", "Makeup", "Animations", "Phone", "Backgrounds", "Sounds" };

    [MenuItem("Playable/Studio/1. 创建导出目录")]
    static void CreateFolders()
    {
        foreach (var f in Folders) Directory.CreateDirectory(Path.Combine(Root, f));
        AssetDatabase.Refresh();
        EditorUtility.DisplayDialog("Playable", "已创建 Assets/PlayableExport/…\n\n目录约定见 PlayableStudio/docs/unity-export.md", "好");
    }

    [MenuItem("Playable/Studio/2. 导出资源包 (给 Studio 导入)")]
    static void Export()
    {
        var tool = EditorPrefs.GetString("PlayableStudioPath", "");
        if (string.IsNullOrEmpty(tool) || !File.Exists(Path.Combine(tool, "tools/unity-export/cli.mjs")))
        {
            tool = EditorUtility.OpenFolderPanel("选择 PlayableStudio 工程目录(里面有 tools/unity-export)", "", "");
            if (string.IsNullOrEmpty(tool)) return;
            EditorPrefs.SetString("PlayableStudioPath", tool);
        }
        var project = Directory.GetParent(Application.dataPath).FullName;
        var outZip = EditorUtility.SaveFilePanel("保存资源包", project, "assets-pack", "zip");
        if (string.IsNullOrEmpty(outZip)) return;
        var psi = new ProcessStartInfo("node", $"tools/unity-export/cli.mjs --project \"{project}\" --out \"{outZip}\"")
        { WorkingDirectory = tool, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        try
        {
            using var p = Process.Start(psi);
            var log = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit();
            UnityEngine.Debug.Log("[Playable 导出]\n" + log);
            EditorUtility.DisplayDialog("Playable", p.ExitCode == 0 ? "导出完成。到 Studio 的“资源库 → 导入资源包”里导入这个 ZIP。\n(详细日志见 Console)" : "导出失败，请看 Console 里的日志。", "好");
        }
        catch (System.Exception e) { EditorUtility.DisplayDialog("Playable", "无法运行 node：" + e.Message + "\n请先安装 Node.js(18 以上)。", "好"); }
    }
}
#endif
