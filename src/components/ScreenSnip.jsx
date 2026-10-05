import React, { useEffect, useRef, useState } from 'react';

/* Pointing at something on the page.

   "What is this bit?" is the question the navigator could not be asked, because
   a chat window has no way of knowing what someone is looking at. Describing it
   in words is exactly the work the person wanted to avoid. So they draw a box
   around it instead.

   The browser will not let a page photograph itself — the only real pixels come
   from `getDisplayMedia`, which asks the person to hand over a tab on purpose.
   That prompt is not an obstacle to route around: it is the thing that makes
   this safe, and it is why the capture happens first and the cropping happens
   afterwards, on a still. One permission, one frame, and the camera is off
   before anything is drawn.

   Nothing is sent from here. The crop goes back to the navigator, which shows
   it and waits — the person sees exactly what would leave the device before any
   of it does. */

/* Retina captures are four times the pixels for no extra legibility once the
   model has them. Crops wider than this are scaled down before encoding. */
const MAX_CROP_WIDTH = 1200;

const grabFrame = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,
  });

  try {
    const track = stream.getVideoTracks()[0];
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    /* One frame is enough, but the first is often still blank: wait for the
       decoder to actually present something before reading it. */
    await new Promise((resolve) => {
      if (video.readyState >= 2 && video.videoWidth) resolve();
      else video.addEventListener('loadeddata', resolve, { once: true });
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    track.stop();
    video.srcObject = null;
    return canvas;
  } finally {
    // Whatever happened, the capture does not outlive this function.
    stream.getTracks().forEach((track) => track.stop());
  }
};

export default function ScreenSnip({ onCapture, onCancel }) {
  const [frame, setFrame] = useState(null);
  const [error, setError] = useState('');
  const [rect, setRect] = useState(null);
  const dragStart = useRef(null);
  const surfaceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = await grabFrame();
        if (!cancelled) setFrame(canvas);
      } catch (failure) {
        if (cancelled) return;
        /* Declining the share is a choice, not a fault, so it closes quietly;
           a browser that cannot do this at all has to say so. */
        if (failure?.name === 'NotAllowedError') onCancel();
        else setError('This browser will not let the page capture itself. You can describe the spot instead.');
      }
    })();
    return () => { cancelled = true; };
  }, [onCancel]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  /* The still is drawn to fit the window, so a drag in screen coordinates has
     to be scaled back to the captured frame before it can crop anything. */
  const pointIn = (event) => {
    const bounds = surfaceRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = pointIn(event);
    setRect(null);
  };

  const onPointerMove = (event) => {
    if (!dragStart.current) return;
    const now = pointIn(event);
    const start = dragStart.current;
    setRect({
      left: Math.min(start.x, now.x),
      top: Math.min(start.y, now.y),
      width: Math.abs(now.x - start.x),
      height: Math.abs(now.y - start.y),
    });
  };

  const onPointerUp = () => {
    dragStart.current = null;
    if (!rect || rect.width < 0.01 || rect.height < 0.01) { setRect(null); return; }

    const sx = Math.round(rect.left * frame.width);
    const sy = Math.round(rect.top * frame.height);
    const sw = Math.max(1, Math.round(rect.width * frame.width));
    const sh = Math.max(1, Math.round(rect.height * frame.height));

    const scale = Math.min(1, MAX_CROP_WIDTH / sw);
    const out = document.createElement('canvas');
    out.width = Math.round(sw * scale);
    out.height = Math.round(sh * scale);
    out.getContext('2d').drawImage(frame, sx, sy, sw, sh, 0, 0, out.width, out.height);

    onCapture(out.toDataURL('image/png'));
  };

  if (error) {
    return (
      <div className="snip-overlay is-message" role="alertdialog" aria-label="Screen capture unavailable">
        <div className="snip-message">
          <p>{error}</p>
          <button type="button" className="snip-cancel" onClick={onCancel}>Close</button>
        </div>
      </div>
    );
  }

  if (!frame) {
    return (
      <div className="snip-overlay is-message" role="status">
        <div className="snip-message">
          <p>Choose this tab in the prompt your browser is showing, and the page will freeze so you can draw a box.</p>
          <button type="button" className="snip-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="snip-overlay" role="dialog" aria-label="Draw a box around the part of the page to ask about">
      <div className="snip-hint">Drag a box around the part you are asking about · Esc to cancel</div>
      <div
        className="snip-surface"
        ref={surfaceRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img src={frame.toDataURL('image/png')} alt="" draggable="false" />
        {/* The dimming is four panels around the selection rather than a hole
            punched in one, so the chosen area is never drawn over. */}
        {rect && (
          <>
            <div className="snip-shade" style={{ left: 0, top: 0, right: 0, height: `${rect.top * 100}%` }} />
            <div className="snip-shade" style={{ left: 0, top: `${(rect.top + rect.height) * 100}%`, right: 0, bottom: 0 }} />
            <div className="snip-shade" style={{ left: 0, top: `${rect.top * 100}%`, width: `${rect.left * 100}%`, height: `${rect.height * 100}%` }} />
            <div className="snip-shade" style={{ left: `${(rect.left + rect.width) * 100}%`, top: `${rect.top * 100}%`, right: 0, height: `${rect.height * 100}%` }} />
            <div
              className="snip-box"
              style={{
                left: `${rect.left * 100}%`,
                top: `${rect.top * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
              }}
            />
          </>
        )}
        {!rect && <div className="snip-shade is-full" />}
      </div>
    </div>
  );
}
