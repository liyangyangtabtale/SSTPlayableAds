using System;
using System.Collections.Generic;
using UnityEngine;

namespace SSTPlayable
{
    /// <summary>
    /// 运行时拼装角色：骨架(rig) + 头/身/眼睛等基础部件 + 可替换的服装/发型/鞋/妆容。
    /// 所有蒙皮部件通过"按骨骼名重绑"挂到同一套骨架上。
    /// </summary>
    public class CharacterDresser : MonoBehaviour
    {
        [Serializable]
        public class BasePart
        {
            public GameObject prefab;
            public Material material;
            [Tooltip("非空则覆盖材质 _MainTex（部分基础材质的贴图引用是断的）")] public Texture2D mainTexture;
            public bool isHead, isBody;
        }

        public GameObject rigPrefab;
        public List<BasePart> baseParts = new List<BasePart>();

        public Animator Animator { get; private set; }
        public Transform RigRoot { get; private set; }
        [Tooltip("手机预设(带 Animator 的手机模型，如 message_animation.prefab)。生成角色时一起生成，默认隐藏，由 PlayableGame 在开场的 takePhone/endPhone 动画时显示并同步播放")] public GameObject phone;
        [Tooltip("手机相对手的微调(世界坐标，米)。动画本身位置不对时在这里补偿，默认 0")] public Vector3 phoneOffset;
        public GameObject Phone { get; private set; }
        public CharacterAnimator PhoneAnimator { get; private set; }
        Dictionary<string, Transform> bones;
        Transform pelvis; Vector3 pelvisRest;
        readonly Dictionary<StageType, GameObject> equipped = new Dictionary<StageType, GameObject>();
        readonly List<Renderer> headRenderers = new List<Renderer>(), bodyRenderers = new List<Renderer>();
        Material headMat; // 头部材质实例：妆容通过它的 _FacePaintTex 切换
        Material headSrc, bodySrc; // SetCharacter 设置的原始头/身体材质，用于 SetSkinOverride 切回
        Texture facePaint;         // 当前妆容贴图，换头部材质时带过去

        public void Build()
        {
            var rig = Instantiate(rigPrefab, transform);
            rig.name = "Rig";
            RigRoot = rig.transform;
            Animator = rig.GetComponentInChildren<Animator>();
            if (Animator == null) Animator = rig.AddComponent<Animator>();
            // 基础模型里可能自带少量 mesh，全部关掉，只用骨架
            foreach (var r in rig.GetComponentsInChildren<Renderer>(true)) r.enabled = false;
            bones = new Dictionary<string, Transform>();
            foreach (var t in rig.GetComponentsInChildren<Transform>(true))
                if (!bones.ContainsKey(t.name)) bones[t.name] = t;

            if (phone != null)
            {
                Phone = Instantiate(phone, transform);
                Phone.name = "Phone";
                var pa = Phone.GetComponentInChildren<Animator>(true);
                if (pa == null) pa = Phone.AddComponent<Animator>();
                pa.runtimeAnimatorController = null; // 只用 PlayableGraph 播放
                PhoneAnimator = Phone.GetComponent<CharacterAnimator>();
                if (PhoneAnimator == null) PhoneAnimator = Phone.AddComponent<CharacterAnimator>();
                PhoneAnimator.Init(pa);
                Phone.SetActive(false);
            }

            if (bones.TryGetValue("Bip001 Pelvis", out pelvis)) pelvisRest = pelvis.position - transform.position; // 相对角色根节点，角色整体移动时不受影响
            foreach (var bp in baseParts)
            {
                if (bp.prefab == null) continue;
                var list = Attach(bp.prefab, bp.material, "base_" + bp.prefab.name);
                // 动画 clip 里脸部表情是 BlendShape 曲线，路径是相对 Animator 根节点的网格名(如 "head"/"eyelash"/"eyebrow")。
                // 网格必须直接挂在 Animator 根下，曲线才能绑定上，否则脸部没有表情动画。
                foreach (var r in list) r.transform.SetParent(Animator.transform, false);
                if (bp.mainTexture != null) foreach (var r in list) r.material.mainTexture = bp.mainTexture;
                if (bp.isHead) headRenderers.AddRange(list);
                if (bp.isBody) bodyRenderers.AddRange(list);
            }
        }

        /// <summary>动画里骨盆会水平位移，这里把整个骨架反向拉回，让角色始终站在原点。</summary>
        void LateUpdate()
        {
            if (pelvis == null || RigRoot == null) return;
            RigRoot.position = transform.position;
            var d = (pelvis.position - transform.position) - pelvisRest;
            RigRoot.position = transform.position - new Vector3(d.x, 0, d.z);
            // 手机的动画是和角色一起做的(位置含骨盆的水平位移)，骨架被拉回原点时手机要平移同样的量，否则手机会偏离手
            if (Phone != null && Phone.activeSelf) Phone.transform.position += RigRoot.position - transform.position + phoneOffset;
        }

        List<Renderer> Attach(GameObject prefab, Material overrideMat, string name)
        {
            var inst = Instantiate(prefab);
            var result = new List<Renderer>();
            foreach (var smr in inst.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                var src = smr.bones;
                var nb = new Transform[src.Length];
                for (int i = 0; i < src.Length; i++)
                    nb[i] = src[i] != null && bones.TryGetValue(src[i].name, out var t) ? t : null;
                smr.bones = nb;
                Transform root = null;
                if (smr.rootBone != null) bones.TryGetValue(smr.rootBone.name, out root);
                smr.rootBone = root != null ? root : RigRoot;
                smr.transform.SetParent(transform, false);
                smr.transform.localPosition = Vector3.zero;
                smr.transform.localRotation = Quaternion.identity;
                smr.transform.localScale = Vector3.one;
                smr.updateWhenOffscreen = true;
                if (overrideMat != null)
                {
                    var mats = new Material[smr.sharedMaterials.Length];
                    for (int i = 0; i < mats.Length; i++) mats[i] = overrideMat;
                    smr.sharedMaterials = mats;
                }
                result.Add(smr);
            }
            foreach (var mr in inst.GetComponentsInChildren<MeshRenderer>(true))
            {
                // 非蒙皮部件（极少数）：挂到同名骨骼上
                if (mr.transform.parent != null && bones.TryGetValue(mr.transform.parent.name, out var bone))
                    mr.transform.SetParent(bone, true);
                else mr.transform.SetParent(transform, true);
                if (overrideMat != null) mr.sharedMaterial = overrideMat;
                result.Add(mr);
            }
            // 蒙皮部件已迁出，剩下的是服装自带的骨架副本，销毁
            var holder = new GameObject(name).transform;
            holder.SetParent(transform, false);
            foreach (var r in result) r.transform.SetParent(holder, true);
            Destroy(inst);
            return result;
        }

        public void SetCharacter(CharacterVariant v)
        {
            if (v == null) return;
            headSrc = v.headMaterial; bodySrc = v.bodyMaterial;
            ApplySkin(headSrc, bodySrc);
        }

        /// <summary>调试：把头/身体换成指定材质(传 null 恢复 SetCharacter 的原始材质)；当前妆容会带到新的头部材质上。</summary>
        public void SetSkinOverride(Material head, Material body)
        {
            ApplySkin(head != null ? head : headSrc, body != null ? body : bodySrc);
        }

        void ApplySkin(Material head, Material body)
        {
            if (head != null)
            {
                var old = headMat;
                headMat = new Material(head); // 实例化，不污染共享材质
                if (facePaint != null && headMat.HasProperty("_FacePaintTex")) headMat.SetTexture("_FacePaintTex", facePaint);
                foreach (var r in headRenderers) SetAll(r, headMat);
                if (old != null) Destroy(old);
            }
            if (body != null) foreach (var r in bodyRenderers) SetAll(r, body);
        }

        static void SetAll(Renderer r, Material m)
        {
            var mats = new Material[r.sharedMaterials.Length];
            for (int i = 0; i < mats.Length; i++) mats[i] = m;
            r.sharedMaterials = mats;
        }

        /// <summary>脱掉某个槽位上的东西（目前仅用于烘焙妆容图标时去掉头发）。</summary>
        public void Unequip(StageType slot)
        {
            if (equipped.TryGetValue(slot, out var old) && old != null) Destroy(old);
            equipped.Remove(slot);
        }

        public void Equip(StageType slot, OptionConfig opt)
        {
            if (slot == StageType.Makeup)
            {
                // 妆容：直接换头部材质的 _FacePaintTex（头部 UV 布局的 RGBA 贴图）
                if (opt.makeupTexture != null) facePaint = opt.makeupTexture;
                if (headMat != null && opt.makeupTexture != null) headMat.SetTexture("_FacePaintTex", opt.makeupTexture);
                return;
            }
            if (equipped.TryGetValue(slot, out var old) && old != null) Destroy(old);
            if (opt.prefab == null) return;
            var holderList = Attach(opt.prefab, opt.material, slot + "_" + opt.id);
            foreach (var r in holderList)
                foreach (var m in r.materials)
                {
                    if (opt.mainTexture != null && m.HasProperty("_MainTex")) m.mainTexture = opt.mainTexture;
                    if (opt.tint.a > 0 && m.HasProperty("_HueColor")) m.SetColor("_HueColor", opt.tint);
                    else m.DisableKeyword("_DISCOLOR_HUE_REPLACE"); // 不着色时直接用贴图原色
                }
            equipped[slot] = holderList.Count > 0 ? holderList[0].transform.parent.gameObject : null;
        }
    }
}
