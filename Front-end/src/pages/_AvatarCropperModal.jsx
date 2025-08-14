import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../styles/avatar-cropper.module.css";

/** Блокируем скролл body только пока открыто */
function useBodyScrollLock(isOpen) {
  useLayoutEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);
}

export default function AvatarCropperModal({
  open = true,
  file,                 // File
  onCancel,
  onConfirm,            // (blob) => void
  outSize = 512,
  maxScaleMultiplier = 4,
}) {
  useBodyScrollLock(open);

  const frameRef = useRef(null);

  const [src, setSrc] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [frameSize, setFrameSize] = useState(360);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [minScale, setMinScale] = useState(1);
  const [maxScale, setMaxScale] = useState(4);

  // objectURL надёжнее FileReader и устраняет «пустой круг»
  useEffect(() => {
    let url = "";
    if (file instanceof Blob) {
      url = URL.createObjectURL(file);
      setSrc(url);
    } else {
      setSrc("");
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file]);

  // узнаём натуральные размеры изображения
  useEffect(() => {
    if (!src) { setNat({ w: 0, h: 0 }); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = async () => {
      try { await img.decode(); } catch {}
      if (!cancelled) setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  // следим за реальным диаметром окна
  useLayoutEffect(() => {
    if (!open || !frameRef.current) return;
    const el = frameRef.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setFrameSize(Math.floor(Math.min(rect.width, rect.height)));
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setFrameSize(Math.floor(Math.min(rect.width, rect.height)));
    return () => ro.disconnect();
  }, [open]);

  const R = useMemo(() => frameSize / 2, [frameSize]);

  // масштаб «как cover»
  const coverScale = useMemo(() => {
    if (!nat.w || !nat.h || !frameSize) return 1;
    return Math.max(frameSize / nat.w, frameSize / nat.h);
  }, [nat.w, nat.h, frameSize]);

  // первичная инициализация и при изменении окна/картинки
  useEffect(() => {
    if (!open || !nat.w || !nat.h || !frameSize) return;
    const min = coverScale;
    const max = coverScale * maxScaleMultiplier;
    setMinScale(min);
    setMaxScale(max);
    setScale(min);                 // сразу закрываем круг
    setOffset({ x: 0, y: 0 });     // центрируем
  }, [open, nat.w, nat.h, frameSize, coverScale, maxScaleMultiplier]);

  // ограничение смещения, чтобы не было «дыр»
  const clampOffset = useCallback((s, off) => {
    const halfW = (nat.w * s) / 2;
    const halfH = (nat.h * s) / 2;
    const minX = R - halfW;
    const maxX = halfW - R;
    const minY = R - halfH;
    const maxY = halfH - R;
    return {
      x: Math.min(Math.max(off.x, minX), maxX),
      y: Math.min(Math.max(off.y, minY), maxY),
    };
  }, [nat.w, nat.h, R]);

  // drag
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  }, [offset]);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const next = { x: offsetStart.current.x + dx, y: offsetStart.current.y + dy };
    setOffset((_) => clampOffset(scale, next));
  }, [clampOffset, scale]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [open, onMouseMove, onMouseUp]);

  // зум — только с Ctrl, и жёстко в пределах [cover, max]
  const onWheel = useCallback((e) => {
    e.stopPropagation();
    if (!e.ctrlKey) return;
    const delta = -e.deltaY * 0.0015;
    setScale((prev) => {
      const s = Math.min(maxScale, Math.max(minScale, prev + delta));
      setOffset((off) => clampOffset(s, off));
      return s;
    });
  }, [minScale, maxScale, clampOffset]);

  const onSlider = useCallback((e) => {
    const s = Math.min(maxScale, Math.max(minScale, parseFloat(e.target.value)));
    setScale(s);
    setOffset((off) => clampOffset(s, off));
  }, [minScale, maxScale, clampOffset]);

  // текущие реальные размеры изображения на экране (px)
  const draw = useMemo(() => ({
    w: nat.w * scale,
    h: nat.h * scale,
  }), [nat.w, nat.h, scale]);

  const handleConfirm = async () => {
    if (!src || !nat.w || !nat.h) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = outSize;
    canvas.height = outSize;

    const img = new Image();
    img.src = src;
    await new Promise((r) => { img.onload = r; });

    // перевод смещения в координаты канваса
    const cx = outSize / 2 + (offset.x / frameSize) * outSize;
    const cy = outSize / 2 + (offset.y / frameSize) * outSize;

    const outW = (draw.w / frameSize) * outSize;
    const outH = (draw.h / frameSize) * outSize;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outSize, outSize);

    ctx.save();
    ctx.beginPath();
    ctx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, cx - outW / 2, cy - outH / 2, outW, outH);
    ctx.restore();

    canvas.toBlob((blob) => { if (blob) onConfirm?.(blob); }, "image/png", 0.95);
  };

  if (!open) return null;

  return (
    <div className={styles.backdrop} onWheel={onWheel} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.title}>Edit avatar</div>

        <div
          ref={frameRef}
          className={`${styles.frame} ${dragging.current ? styles.grabbing : ""}`}
          onMouseDown={onMouseDown}
        >
          {src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                width: `${draw.w}px`,
                height: `${draw.h}px`,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          ) : (
            <div className={styles.empty}>Choose an image…</div>
          )}
        </div>

        <input
          className={styles.slider}
          type="range"
          min={minScale}
          max={maxScale}
          step="0.01"
          value={scale}
          onChange={onSlider}
        />
        <div className={styles.hint}>
          Hint: use mouse wheel with Ctrl to zoom, drag to move the image.
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleConfirm}>Save</button>
        </div>
      </div>
    </div>
  );
}
