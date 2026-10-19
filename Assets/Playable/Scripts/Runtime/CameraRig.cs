using UnityEngine;

namespace SSTPlayable
{
    public class CameraRig : MonoBehaviour
    {
        public Camera cam;
        public float smooth = 0.35f;
        Vector3 targetPos, vel; Quaternion targetRot = Quaternion.identity;
        float targetFov = 30f, fovVel;

        public void Snap(CameraShot s)
        {
            Set(s);
            cam.transform.SetPositionAndRotation(targetPos, targetRot);
            cam.fieldOfView = targetFov;
        }

        public void Set(CameraShot s)
        {
            if (s == null) return;
            targetPos = s.position; targetRot = Quaternion.Euler(s.euler); targetFov = s.fov;
        }

        void LateUpdate()
        {
            var t = cam.transform;
            t.position = Vector3.SmoothDamp(t.position, targetPos, ref vel, smooth);
            t.rotation = Quaternion.Slerp(t.rotation, targetRot, 1f - Mathf.Exp(-Time.deltaTime / Mathf.Max(0.01f, smooth) * 3f));
            cam.fieldOfView = Mathf.SmoothDamp(cam.fieldOfView, targetFov, ref fovVel, smooth);
        }
    }
}
