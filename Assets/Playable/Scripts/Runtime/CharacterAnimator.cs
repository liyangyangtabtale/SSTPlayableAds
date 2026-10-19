using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace SSTPlayable
{
    /// <summary>
    /// 不依赖 AnimatorController，用 PlayableGraph 播放 FBX 里的 clip：
    /// 淡入淡出、"播完接下一个"、按顺序播一串动画(最后一个循环)、非循环动画可限制最长时长。
    /// </summary>
    public class CharacterAnimator : MonoBehaviour
    {
        struct Step { public AnimationClip clip; public float length; public bool loop; }

        PlayableGraph graph;
        AnimationMixerPlayable mixer;
        readonly AnimationClipPlayable[] slots = new AnimationClipPlayable[2];
        readonly Queue<Step> queue = new Queue<Step>();
        int cur = -1;
        float fadeT = 1f, fadeDur = 0.25f;
        Step curStep;

        public void Init(Animator animator)
        {
            animator.applyRootMotion = false;
            graph = PlayableGraph.Create("Character");
            graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            mixer = AnimationMixerPlayable.Create(graph, 2);
            var output = AnimationPlayableOutput.Create(graph, "anim", animator);
            output.SetSourcePlayable(mixer);
            graph.Play();
        }

        /// <summary>播放 clip；播完(非循环时)接着循环播放 then(可为空，空则停在最后一帧)。</summary>
        public void Play(AnimationClip clip, bool loop, AnimationClip then = null, float fade = 0.25f)
        {
            queue.Clear();
            if (then != null) queue.Enqueue(new Step { clip = then, length = then.length, loop = true });
            Begin(new Step { clip = clip, length = clip != null ? clip.length : 0, loop = loop }, fade);
        }

        public void Play(AnimEntry e, bool loop, AnimEntry then = null, float fade = 0.25f)
        {
            queue.Clear();
            if (then != null && then.clip != null) queue.Enqueue(Make(then, true));
            if (e != null && e.clip != null) Begin(Make(e, loop), fade);
            else if (queue.Count > 0) Begin(queue.Dequeue(), fade);
        }

        /// <summary>依次播放，前面的各播一遍(受 maxDuration 限制)，最后一个循环。</summary>
        public void PlaySequence(params AnimEntry[] entries)
        {
            queue.Clear();
            var steps = new List<Step>();
            foreach (var e in entries) if (e != null && e.clip != null) steps.Add(Make(e, false));
            if (steps.Count == 0) return;
            var last = steps[steps.Count - 1]; last.loop = true; steps[steps.Count - 1] = last;
            for (int i = 1; i < steps.Count; i++) queue.Enqueue(steps[i]);
            Begin(steps[0], 0.25f);
        }

        /// <summary>把角色定格在 clip 的某一时刻（仅用于无人值守预览动画）。</summary>
        public void Freeze(AnimationClip clip, float time)
        {
            queue.Clear();
            Begin(new Step { clip = clip, length = clip.length, loop = false }, 0.01f);
            slots[cur].SetTime(time); slots[cur].SetSpeed(0);
            fadeT = 1f; mixer.SetInputWeight(cur, 1f);
            int prev = cur == 0 ? 1 : 0;
            if (slots[prev].IsValid()) mixer.SetInputWeight(prev, 0f);
        }

        /// <summary>一段动画实际播放的秒数(受 maxDuration 限制)。</summary>
        public static float Length(AnimEntry e) => e == null || e.clip == null ? 0f : (e.maxDuration > 0 ? Mathf.Min(e.maxDuration, e.clip.length) : e.clip.length);

        static Step Make(AnimEntry e, bool loop) => new Step
        {
            clip = e.clip, loop = loop,
            length = e.maxDuration > 0 ? Mathf.Min(e.maxDuration, e.clip.length) : e.clip.length
        };

        void Begin(Step s, float fade)
        {
            if (s.clip == null || !graph.IsValid()) return;
            int next = cur == 0 ? 1 : 0;
            if (slots[next].IsValid()) { mixer.DisconnectInput(next); slots[next].Destroy(); }
            slots[next] = AnimationClipPlayable.Create(graph, s.clip);
            slots[next].SetApplyFootIK(false);
            graph.Connect(slots[next], 0, mixer, next);
            mixer.SetInputWeight(next, cur < 0 ? 1f : 0f);
            fadeT = cur < 0 ? 1f : 0f; fadeDur = Mathf.Max(0.01f, fade);
            cur = next; curStep = s;
        }

        void Update()
        {
            if (cur < 0 || !graph.IsValid()) return;
            int prev = cur == 0 ? 1 : 0;
            if (fadeT < 1f)
            {
                fadeT = Mathf.Min(1f, fadeT + Time.deltaTime / fadeDur);
                mixer.SetInputWeight(cur, fadeT);
                if (slots[prev].IsValid()) mixer.SetInputWeight(prev, 1f - fadeT);
            }
            var p = slots[cur];
            if (curStep.loop)
            {
                if (p.GetTime() >= curStep.clip.length) p.SetTime(p.GetTime() % curStep.clip.length);
                return;
            }
            // 结束前一个淡入时长就切到下一段，与本段尾部交叉淡化；没有下一段则停在最后一帧
            if (queue.Count > 0)
            {
                if (p.GetTime() >= curStep.length - fadeDur) Begin(queue.Dequeue(), 0.25f);
            }
            else if (p.GetTime() >= curStep.length - 0.02f) p.SetSpeed(0);
        }

        void OnDestroy() { if (graph.IsValid()) graph.Destroy(); }
    }
}
