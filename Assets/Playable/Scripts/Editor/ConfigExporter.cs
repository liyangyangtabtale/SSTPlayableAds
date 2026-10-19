using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace SSTPlayable.Editor
{
    /// <summary>把 PlayableConfig 导出为 Three.js 端读取的 config.json（schema 与 PlayableWeb/public/config.json 一致）。</summary>
    public static class ConfigExporter
    {
        const string OutPath = "PlayableWeb/public/config.json";

        [MenuItem("Playable/4. Export Config JSON (Web)")]
        public static void Export()
        {
            var cfg = AssetDatabase.LoadAssetAtPath<PlayableConfig>(DefaultConfigBuilder.ConfigPath);
            if (cfg == null) { Debug.LogError("找不到 PlayableConfig"); return; }
            File.WriteAllText(OutPath, ToJson(cfg), new UTF8Encoding(false));
            Debug.Log("[Playable] 已导出 " + OutPath);
        }

        static string Hex(Color c) => "#" + ColorUtility.ToHtmlStringRGB(c).ToLower();
        static string Q(string s) => JsonUtility.ToJson(new W { s = s }).Replace("{\"s\":", "").TrimEnd('}');
        [System.Serializable] class W { public string s; }
        static string B(bool b) => b ? "true" : "false";
        static string N(float f) => f.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>有 maxDuration 的动画导出为 anims.max（秒），Web 端据此截断并裁剪资源。</summary>
        static string MaxJson(PlayableConfig c)
        {
            var parts = new System.Collections.Generic.List<string>();
            foreach (var e in new[] { c.introAnim, c.introReactAnim, c.pickGoodAnim, c.pickBadAnim, c.goodAnim, c.badAnim, c.idleAnim })
                if (e != null && e.maxDuration > 0) parts.Add($"{Q(e.webName)}: {N(e.maxDuration)}");
            return parts.Count == 0 ? "" : ", \"max\": { " + string.Join(", ", parts) + " }";
        }

        /// <summary>结局男角色。位置/朝向沿用 Unity 世界坐标，Web 端自己镜像(x 取负，yaw 取负)。</summary>
        static string PartnerJson(PlayableConfig c)
        {
            var p = c.partner;
            if (p == null || !p.enabled || p.rigPrefab == null) return "";
            var parts = new System.Collections.Generic.List<string>();
            for (int i = 0; i < p.parts.Count; i++)
            {
                if (p.parts[i].prefab == null) continue;
                var tex = i < p.webTextures.Count ? p.webTextures[i] : "";
                parts.Add($"{{\"model\": {Q(p.parts[i].prefab.name)}, \"tex\": {Q(tex)}}}");
            }
            return $" \"partner\": {{ \"rig\": {Q(p.rigPrefab.name)}, \"parts\": [{string.Join(", ", parts)}], \"startX\": {N(p.startPos.x)}, \"endX\": {N(p.endPos.x)}, \"walkSpeed\": {N(p.walkSpeed)}, \"walkYaw\": {N(p.walkYaw)}, \"endYaw\": {N(p.endYaw)}, \"anims\": {{ \"walk\": {Q(p.walkAnim.webName)}, \"good\": {Q(p.goodAnim.webName)}, \"bad\": {Q(p.badAnim.webName)} }} }},\n";
        }

        public static string ToJson(PlayableConfig c)
        {
            var t = c.theme; var sb = new StringBuilder();
            sb.Append("{\n");
            sb.Append($" \"theme\": {{ \"id\": {Q(t.id)}, \"bg\": \"{Hex(t.bgTop)}\", \"bg2\": \"{Hex(t.bgBottom)}\", {(t.backgroundImage != null ? "\"bgImage\": " + Q("ui/bg_" + t.id + ".webp") + ", " : "")}\"title\": {Q(t.title)},\n");
            sb.Append($"   \"intro\": {{ \"sender\": {Q(t.introSender)}, \"message\": {Q(t.introMessage)}, \"tap\": {Q(t.tapText)} }}, \"cta\": {Q(t.cta)}, \"confirm\": {Q(t.confirmText)},\n");
            sb.Append($"   \"endings\": {{ \"good\": {{ \"title\": {Q(t.goodEnding.title)}, \"sub\": {Q(t.goodEnding.sub)} }}, \"bad\": {{ \"title\": {Q(t.badEnding.title)}, \"sub\": {Q(t.badEnding.sub)} }} }} }},\n");
            var ch = c.characters.Count > 0 ? c.characters[Mathf.Clamp(c.characterIndex, 0, c.characters.Count - 1)] : null;
            sb.Append($" \"character\": {{ \"body\": {Q(ch != null ? ch.webBodyTex : "body_101")}, \"head\": {Q(ch != null ? ch.webHeadTex : "head_101")}, \"eyebrow\": \"eyebrow\", \"eyelash\": \"eyelash\", \"eyeball\": \"eyeball\" }},\n");
            sb.Append($" \"defaults\": {{ \"outfits\": [{string.Join(", ", c.defaults.outfits.ConvertAll(o => Q(o.id + "_c1")))}], \"outfit\": {Q(c.defaults.Outfit != null ? c.defaults.Outfit.id + "_c1" : "")}, \"hair\": {Q(c.defaults.hair != null ? c.defaults.hair.id + "_c1" : "")} }},\n");
            sb.Append($" \"anims\": {{ \"idle\": {Q(c.idleAnim.webName)}, \"intro\": {Q(c.introAnim.webName)}, \"introReact\": {Q(c.introReactAnim.webName)}, \"pickGood\": {Q(c.pickGoodAnim.webName)}, \"pickBad\": {Q(c.pickBadAnim.webName)}, \"pick\": {Q(c.pickGoodAnim.webName)}, \"win\": {Q(c.goodAnim.webName)}, \"lose\": {Q(c.badAnim.webName)}{MaxJson(c)}, \"introIdleTime\": {N(c.introIdleTime)} }},\n");
            sb.Append(PartnerJson(c));
            sb.Append($" \"goodThreshold\": {N(c.goodThreshold)},\n \"introAutoAdvance\": {N(c.introAutoAdvance)},\n \"stages\": [\n");
            for (int i = 0; i < c.stages.Count; i++)
            {
                var s = c.stages[i];
                sb.Append($"  {{ \"id\": {Q(s.type.ToString().ToLower())}, \"label\": {Q(s.label)}, \"enabled\": {B(s.enabled)}, \"cols\": {s.columns}, \"count\": {s.count}, \"cam\": {Q(s.shotId)},\n    \"options\": [");
                for (int k = 0; k < s.options.Count; k++)
                {
                    var o = s.options[k];
                    var file = s.type == StageType.Makeup ? o.id : o.id + "_c1";
                    var tint = o.tint.a > 0 ? $",\"tint\":\"{Hex(o.tint)}\"" : "";
                    sb.Append($"{(k > 0 ? ", " : "")}{{\"file\":{Q(file)},\"good\":{B(o.good)}{tint}}}");
                }
                sb.Append($"] }}{(i < c.stages.Count - 1 ? "," : "")}\n");
            }
            sb.Append(" ]\n}\n");
            return sb.ToString();
        }
    }
}
