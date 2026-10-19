using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace SSTPlayable.Editor
{
    /// <summary>检查配置里的资源引用是否都还在（资源移动/改名/删除后跑一遍）。只报告，不修改配置。</summary>
    public static class ConfigValidator
    {
        [MenuItem("Playable/5. Validate Config (检查资源引用)")]
        public static void Run()
        {
            var cfg = AssetDatabase.LoadAssetAtPath<PlayableConfig>(DefaultConfigBuilder.ConfigPath);
            if (cfg == null) { Debug.LogError("[Playable] 找不到 PlayableConfig"); return; }
            Debug.Log("[Playable] 配置检查：" + Validate(cfg) + " 个问题");
        }

        public static int Validate(PlayableConfig c)
        {
            var problems = new List<string>();
            void Need(Object o, string what) { if (o == null) problems.Add(what); }

            for (int i = 0; i < c.characters.Count; i++)
            {
                Need(c.characters[i].headMaterial, $"characters[{i}].headMaterial");
                Need(c.characters[i].bodyMaterial, $"characters[{i}].bodyMaterial");
            }
            foreach (var o in c.defaults.outfits) Need(o.prefab, "默认衣服 " + o.id + " 的 prefab");
            Need(c.defaults.hair != null ? c.defaults.hair.prefab : null, "默认发型 prefab");
            foreach (var s in c.stages)
            {
                if (s.options.Count == 0) problems.Add($"阶段 {s.type} 没有任何选项");
                foreach (var o in s.options)
                {
                    if (s.type == StageType.Makeup) Need(o.makeupTexture, $"{s.type}/{o.id} 的 facepaint 贴图");
                    else { Need(o.prefab, $"{s.type}/{o.id} 的 prefab"); Need(o.material, $"{s.type}/{o.id} 的材质"); }
                    Need(o.icon, $"{s.type}/{o.id} 的图标");
                }
            }
            foreach (var (n, e) in new[] { ("idleAnim", c.idleAnim), ("introAnim", c.introAnim), ("introReactAnim", c.introReactAnim), ("pickGoodAnim", c.pickGoodAnim), ("pickBadAnim", c.pickBadAnim), ("goodAnim", c.goodAnim), ("badAnim", c.badAnim) })
                Need(e != null ? e.clip : null, n + " 的动画 clip");
            if (c.partner != null && c.partner.enabled)
            {
                Need(c.partner.rigPrefab, "男角色骨架 prefab");
                for (int i = 0; i < c.partner.parts.Count; i++) { Need(c.partner.parts[i].prefab, $"男角色 parts[{i}] 模型"); Need(c.partner.parts[i].material, $"男角色 parts[{i}] 材质"); }
                foreach (var (n, e) in new[] { ("walkAnim", c.partner.walkAnim), ("goodAnim", c.partner.goodAnim), ("badAnim", c.partner.badAnim) })
                    Need(e != null ? e.clip : null, "男角色 " + n + " 的动画 clip");
            }
            foreach (var p in problems) Debug.LogWarning("[Playable] 配置问题: 缺少 " + p);
            return problems.Count;
        }
    }
}
