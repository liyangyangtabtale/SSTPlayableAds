using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace SSTPlayable
{
    /// <summary>流程：开场(短信气泡) → 各换装阶段(选择 + 确认) → 结局。阶段顺序/开关由配置决定。</summary>
    public class PlayableGame : MonoBehaviour
    {
        public PlayableConfig config;
        public CharacterDresser dresser;
        public CharacterAnimator characterAnimator;
        public CameraRig cameraRig;
        public GameUI ui;

        CharacterDresser partner; CharacterAnimator partnerAnimator;
        Vector3 girlHome; Transform girlShadow; bool endingStarted;

        List<StageConfig> stages;
        int stageIndex;
        int goodCount, pickCount;
        bool currentGood, picked, introDone, introReady;

        void Start()
        {
            girlHome = dresser.transform.position;
            var sh = GameObject.Find("FootShadow"); if (sh != null) girlShadow = sh.transform;
            dresser.Build();
            dresser.SetCharacter(config.characters.Count > 0 ? config.characters[Mathf.Clamp(config.characterIndex, 0, config.characters.Count - 1)] : null);
            characterAnimator.Init(dresser.Animator);
            // 开场就穿着默认衣服和默认发型
            if (config.defaults.Outfit != null) dresser.Equip(StageType.Outfit, config.defaults.Outfit);
            if (config.defaults.hair != null && config.defaults.hair.prefab != null) dresser.Equip(StageType.Hair, config.defaults.hair);
            ui.ApplyTheme(config.theme);
            ui.ending.onCta = () => Debug.Log("[Playable] Open store");
            stages = config.ActiveStages();
            BuildPartner();
            StartIntro();
        }

        void StartIntro()
        {
            ui.HideAll();
            cameraRig.Snap(config.GetShot("intro"));
            characterAnimator.Play(config.idleAnim, true);
            ui.intro.Show(config.theme, config.introAutoAdvance <= 0f, EndIntro);
            StartCoroutine(IntroSequence());
        }

        /// <summary>待机 → 短信到达(气泡 + 看手机动画) → 反应动画 → 回到待机。</summary>
        IEnumerator IntroSequence()
        {
            yield return new WaitForSeconds(config.introIdleTime);
            characterAnimator.PlaySequence(config.introAnim, config.introReactAnim, config.idleAnim);
            StartCoroutine(PhoneSequence());
            yield return new WaitForSeconds(config.introBubbleDelay);
            ui.intro.SetBubbleVisible(true);
            yield return new WaitForSeconds(config.introTapDelay);
            introReady = true;
            ui.intro.SetTapVisible(true);
            if (config.introAutoAdvance > 0f) { yield return new WaitForSeconds(config.introAutoAdvance); EndIntro(); }
        }

        /// <summary>手机：显示，和角色的 takePhone / endPhone 同时播放同名动画，endPhone 播完(角色转入待机)后隐藏。</summary>
        IEnumerator PhoneSequence()
        {
            if (dresser.Phone == null || dresser.PhoneAnimator == null) yield break;
            var take = new AnimEntry { clip = config.phoneTakeClip, maxDuration = config.introAnim != null ? config.introAnim.maxDuration : 0 };
            var end = new AnimEntry { clip = config.phoneEndClip, maxDuration = config.introReactAnim != null ? config.introReactAnim.maxDuration : 0 };
            if (take.clip == null && end.clip == null) yield break;
            dresser.Phone.SetActive(true);
            dresser.PhoneAnimator.PlaySequence(take, end);
            // 角色那边：takePhone 播到 (长度-0.25) 切 endPhone，endPhone 播到 (长度-0.25) 切待机，手机也在那时收起
            float t = Mathf.Max(0f, CharacterAnimator.Length(config.introAnim) - 0.25f) + Mathf.Max(0f, CharacterAnimator.Length(config.introReactAnim) - 0.25f);
            yield return new WaitForSeconds(t);
            dresser.Phone.SetActive(false);
        }

        void EndIntro()
        {
            if (introDone || !introReady) return;
            introDone = true;
            StartStage(0);
        }

        void StartStage(int i)
        {
            stageIndex = i;
            if (i >= stages.Count) { if (endingStarted) return; endingStarted = true; StartEnding(); return; }
            var s = stages[i];
            picked = false;
            ui.HideAll();
            ui.SetTitle(config.theme.title);
            // 换装阶段相机不切换：所有阶段共用同一个镜头(默认 full)，不同阶段想切再在 StageConfig.shotId 里改
            cameraRig.Set(config.GetShot(s.shotId));
            ui.stage.Show(stages, i, config.theme.confirmText, OnPick, OnConfirm);
        }

        void OnPick(OptionConfig o)
        {
            if (picked && currentGood) goodCount--;
            if (!picked) pickCount++;
            picked = true;
            currentGood = o.good;
            if (o.good) goodCount++;
            dresser.Equip(stages[stageIndex].type, o);
            // 选对/选错各有反馈动画，播完回到待机
            characterAnimator.Play(o.good ? config.pickGoodAnim : config.pickBadAnim, false, config.idleAnim);
        }

        void OnConfirm()
        {
            if (!picked) return;
            StartStage(stageIndex + 1);
        }

        /// <summary>结局男角色：用和女角色相同的"骨架 + 部件重绑"方式拼装，先隐藏。</summary>
        void BuildPartner()
        {
            var pc = config.partner;
            if (pc == null || !pc.enabled || pc.rigPrefab == null) return;
            var go = new GameObject("Partner", typeof(CharacterDresser), typeof(CharacterAnimator));
            go.transform.SetParent(transform, false);
            partner = go.GetComponent<CharacterDresser>();
            partner.rigPrefab = pc.rigPrefab; partner.baseParts = pc.parts;
            partner.Build();
            var anim = partner.Animator;
            anim.runtimeAnimatorController = null; // 只用 PlayableGraph 播放
            partnerAnimator = go.GetComponent<CharacterAnimator>(); partnerAnimator.Init(anim);
            var shadow = GameObject.Find("FootShadow");
            if (shadow != null) Instantiate(shadow, go.transform).transform.localPosition = new Vector3(0, 0.01f, 0);
            go.SetActive(false);
        }

        void StartEnding()
        {
            float score = pickCount == 0 ? 0 : (float)goodCount / pickCount;
            bool good = score >= config.goodThreshold;
            Debug.Log($"[Playable] ending good={good} score={score:0.00}");
            StartCoroutine(EndingSequence(good));
        }

        /// <summary>
        /// 换装结束 → 闪白 → (白屏时)换结局背景、镜头切到结局、两人直接站到位(待机) → 稍停 → 按好/坏结局做反应 → 结局文案 → Play Now。
        /// </summary>
        IEnumerator EndingSequence(bool good)
        {
            var pc = config.partner;
            bool hasPartner = partner != null && pc != null;
            Vector3 girlPos = girlHome;
            // 女角色站定朝向 = 略微转向男角色(按位置自动算符号)
            float girlYaw = hasPartner ? Mathf.Abs(pc.girlEndYaw) * (pc.endPos.x >= girlPos.x ? 1f : -1f) : 0f;

            yield return StartCoroutine(ui.Flash(config.endFlashTime, () =>
            {
                ui.HideAll();
                ui.ApplyEndBackground(config.theme);
                cameraRig.Snap(config.GetShot("ending"));
                ui.ending.Show(good ? config.theme.goodEnding : config.theme.badEnding, config.theme.cta); // 文案/按钮按时机显示
                SetGirl(girlPos, girlYaw);
                characterAnimator.Play(config.idleAnim, true);
                if (hasPartner)
                {
                    partner.gameObject.SetActive(true);
                    partner.transform.SetPositionAndRotation(pc.endPos, Quaternion.Euler(0, pc.endYaw, 0));
                    partnerAnimator.Play(PartnerIdle(), true);
                }
            }));

            yield return new WaitForSeconds(0.3f);
            characterAnimator.Play(good ? config.goodAnim : config.badAnim, false, null);
            yield return StartCoroutine(ShowEndingUI());
        }

        /// <summary>男角色待机动画：优先用 partner.idleAnim，没填就回退到女角色的待机。</summary>
        AnimEntry PartnerIdle()
        {
            var e = config.partner != null ? config.partner.idleAnim : null;
            return e != null && e.clip != null ? e : config.idleAnim;
        }

        /// <summary>移动女角色(连同脚下阴影)并设置朝向。</summary>
        void SetGirl(Vector3 pos, float yaw)
        {
            dresser.transform.SetPositionAndRotation(pos, Quaternion.Euler(0, yaw, 0));
            if (girlShadow != null) girlShadow.position = new Vector3(pos.x, girlShadow.position.y, pos.z);
        }

        /// <summary>男角色站定后：等 endingUiDelay 显示结局文案，再等 endingCtaDelay 显示 Play Now。</summary>
        IEnumerator ShowEndingUI()
        {
            yield return new WaitForSeconds(config.endingUiDelay);
            ui.ending.SetTextVisible(true);
            yield return new WaitForSeconds(config.endingCtaDelay);
            ui.ending.SetCtaVisible(true);
        }
    }
}
