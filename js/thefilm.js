// THE FILM — click-to-load YouTube player.
// The poster is our own still inside a <button>; nothing is requested from YouTube until it is pressed.
// Self-contained (no imports), so the film still plays if the rest of the page fails to boot.
// Sound on the page is exclusive: starting the film pauses the audio dock and any video with sound
// ('sound:exclusive' detail 'film'); starting any of those pauses the film again.
const ORIGIN = 'https://www.youtube-nocookie.com';
const root = document.documentElement;

for (const box of document.querySelectorAll('[data-yt]')) {
  const btn = box.querySelector('[data-yt-play]');
  if (!btn) continue;
  let iframe = null, heard = false, state = -1;

  const post = (msg) => { try { iframe.contentWindow.postMessage(JSON.stringify(msg), ORIGIN); } catch (e) { /* player not ready */ } };
  // ask the player for state changes (the protocol the official iframe API uses); harmless if it never answers
  function handshake() {
    let n = 0;
    const ping = () => {
      if (heard || !iframe || n++ > 20) return;
      post({ event: 'listening', id: 'thefilm', channel: 'widget' });
      post({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 'thefilm', channel: 'widget' });
      setTimeout(ping, 500);
    };
    ping();
  }

  btn.addEventListener('click', () => {
    if (iframe) return;
    const q = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1', enablejsapi: '1' });
    if (/^https?:$/.test(location.protocol)) q.set('origin', location.origin);
    iframe = document.createElement('iframe');
    iframe.title = box.dataset.ytTitle || 'YouTube';
    // fullscreen via allowfullscreen, like YouTube's own embed code ('fullscreen' in allow as well only adds a console warning)
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    // the page sends no referrer at all (meta referrer), but YouTube refuses to play embeds without one
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = `${ORIGIN}/embed/${encodeURIComponent(box.dataset.yt)}?${q}`;
    iframe.addEventListener('load', handshake);
    // the custom cursor cannot follow the pointer inside the player: hide it there (YouTube shows its own)
    iframe.addEventListener('pointerenter', () => root.classList.add('cursor-off'));
    iframe.addEventListener('pointerleave', () => root.classList.remove('cursor-off'));
    document.dispatchEvent(new CustomEvent('sound:exclusive', { detail: 'film' }));
    box.classList.add('is-on');
    btn.replaceWith(iframe);
    // keyboard users land in the player (Space / K toggles playback there)
    try { iframe.focus({ preventScroll: true }); } catch (e) { iframe.focus(); }
  });

  addEventListener('message', (e) => {
    if (!iframe || e.origin !== ORIGIN || e.source !== iframe.contentWindow) return;
    heard = true;
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
    if (!d || typeof d !== 'object') return;
    let s = null;
    if (d.event === 'onStateChange' && typeof d.info === 'number') s = d.info;
    else if (d.event === 'infoDelivery' && d.info && typeof d.info.playerState === 'number') s = d.info.playerState;
    if (s === null) return;
    // 1 = playing: the visitor (re)started the film from the player's own controls
    if (s === 1 && state !== 1) document.dispatchEvent(new CustomEvent('sound:exclusive', { detail: 'film' }));
    state = s;
  });

  document.addEventListener('sound:exclusive', (e) => {
    if (e.detail !== 'film' && iframe) post({ event: 'command', func: 'pauseVideo', args: [] });
  });
}
