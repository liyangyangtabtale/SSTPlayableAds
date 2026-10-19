// 渠道适配：CTA 调用、MRAID 就绪、静音策略。导出时由 Studio 写入 __PLAYABLE__.channel；预览/独立打开时是 'preview'。
const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && typeof document !== 'undefined' && 'ontouchend' in document);
export class Channel {
  constructor(id, urls) { this.id = id || 'preview'; this.urls = urls || {}; }
  storeUrl() { return (isIOS ? this.urls.ios : this.urls.android) || this.urls.android || this.urls.ios || ''; }
  /** 渠道要求先等就绪(MRAID)；返回 Promise */
  ready() {
    const m = window.mraid;
    if (!m || !['applovin', 'unity', 'ironsource'].includes(this.id)) return Promise.resolve();
    return new Promise(res => { const go = () => res(); if (m.getState && m.getState() === 'loading') m.addEventListener('ready', go); else go(); });
  }
  /** 渠道要求不可见/未开始时静音 */
  onVisibility(cb) {
    const m = window.mraid;
    if (m && m.addEventListener && ['applovin', 'unity', 'ironsource'].includes(this.id)) m.addEventListener('viewableChange', v => cb(!v));
    document.addEventListener('visibilitychange', () => cb(document.hidden));
  }
  cta() {
    const url = this.storeUrl(); const w = window;
    try {
      switch (this.id) {
        case 'applovin': case 'unity': case 'ironsource': if (w.mraid) return w.mraid.open(url); break;
        case 'meta': if (w.FbPlayableAd) return w.FbPlayableAd.onCTAClick(); break;
        case 'google': if (w.ExitApi) return w.ExitApi.exit(); break;
        case 'tiktok': if (w.openAppStore) return w.openAppStore(); break;
        case 'mintegral': if (w.install) return w.install(); break;
      }
    } catch (e) { console.warn('CTA 调用失败', e); }
    // 预览或渠道接口不可用：通知外层并打开商店链接
    try { w.dispatchEvent(new CustomEvent('playable-cta', {detail: url})); w.parent !== w && w.parent.postMessage({type: 'playable-cta', url}, '*'); } catch (e) {}
    if (url && w.parent === w) w.open(url, '_blank');
  }
}
