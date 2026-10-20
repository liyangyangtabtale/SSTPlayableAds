using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

namespace SSTPlayable
{
    /// <summary>左右拖动屏幕，绕 Y 轴旋转角色预览；按在 UI 上开始的拖动不算，松手后带惯性。由 PlayableGame 在换装阶段开启。</summary>
    public class CharacterDragRotate : MonoBehaviour
    {
        [Tooltip("横向拖过整个屏幕宽度时转多少度")] public float degreesPerScreen = 360f;
        [Tooltip("松手后每帧(按 60fps)保留的转速比例，0 = 没有惯性")] [Range(0f, 0.99f)] public float inertia = 0.92f;
        public bool interactable;

        bool dragging;
        float lastX, velocity; // velocity：度/秒
        static readonly List<RaycastResult> hits = new List<RaycastResult>();

        void Update()
        {
            if (!interactable) { dragging = false; velocity = 0f; return; }
            if (Input.GetMouseButtonDown(0) && !OverUI(Input.mousePosition)) { dragging = true; lastX = Input.mousePosition.x; velocity = 0f; }
            if (dragging && Input.GetMouseButton(0))
            {
                float dx = Input.mousePosition.x - lastX; lastX = Input.mousePosition.x;
                // 屏幕右 = 世界 -x，往右拖要让角色正面往右转，所以取负
                float deg = -dx / Mathf.Max(1, Screen.width) * degreesPerScreen;
                transform.Rotate(0f, deg, 0f, Space.World);
                if (Time.deltaTime > 0f) velocity = Mathf.Lerp(velocity, deg / Time.deltaTime, 0.5f);
                return;
            }
            dragging = false;
            if (Mathf.Abs(velocity) < 1f) { velocity = 0f; return; }
            transform.Rotate(0f, velocity * Time.deltaTime, 0f, Space.World);
            velocity *= Mathf.Pow(inertia, Time.deltaTime * 60f);
        }

        static bool OverUI(Vector2 pos)
        {
            var es = EventSystem.current;
            if (es == null) return false;
            hits.Clear();
            es.RaycastAll(new PointerEventData(es) { position = pos }, hits);
            return hits.Count > 0;
        }
    }
}
