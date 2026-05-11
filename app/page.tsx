'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Toast, { ToastKind } from './components/Toast';

type GalleryItem = {
  id: string;
  src: string;
  name: string;
};

type SendStatus = 'idle' | 'loading' | 'success' | 'error';
type Mode = 'telegram' | 'email';

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
type SizeOption = (typeof SIZE_OPTIONS)[number];

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export default function Page() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [lbIndex, setLbIndex] = useState<number>(-1);
  const [isDragover, setIsDragover] = useState<boolean>(false);
  const [shortDesc, setShortDesc] = useState<string>('');
  const [longDesc, setLongDesc] = useState<string>('');
  const [priceValue, setPriceValue] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<Set<SizeOption>>(() => new Set());
  const [mode, setMode] = useState<Mode>('telegram');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [toast, setToast] = useState<{ kind: ToastKind; message: string; key: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef<number>(0);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToast({ kind, message, key: Date.now() });
  }, []);

  const toggleSize = useCallback((size: SizeOption) => {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (items.length === 0) {
      showToast('error', 'Добавьте хотя бы одно фото');
      return;
    }
    if (!shortDesc.trim()) {
      showToast('error', 'Заполните заголовок');
      return;
    }
    const endpoint = mode === 'email' ? '/api/email' : '/api/telegram';
    const successMsg = mode === 'email' ? 'Письмо отправлено' : 'Отправлено в Telegram';
    const sizes = SIZE_OPTIONS.filter((s) => selectedSizes.has(s));

    setSendStatus('loading');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortDesc,
          longDesc,
          price: priceValue,
          sizes,
          items: items.map(({ src, name }) => ({ src, name })),
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
      if (res.ok && data.ok) {
        setSendStatus('success');
        showToast('success', successMsg);
        setTimeout(() => setSendStatus('idle'), 2000);
      } else {
        setSendStatus('error');
        showToast('error', data?.error || 'Ошибка отправки');
        setTimeout(() => setSendStatus('idle'), 100);
      }
    } catch {
      setSendStatus('error');
      showToast('error', 'Сервис недоступен');
      setTimeout(() => setSendStatus('idle'), 100);
    }
  }, [items, shortDesc, longDesc, priceValue, selectedSizes, mode, showToast]);

  // Pre-fill из URL query params (Gemini подставляет через URL)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const s = p.get('short');
    if (s !== null) setShortDesc(s);
    const l = p.get('long');
    if (l !== null) setLongDesc(l);
    if (p.get('state') === 'email') setMode('email');
  }, []);

  // ===== Gallery state mutators =====
  const addItem = useCallback((item: GalleryItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addFromFile = useCallback(
    async (file: File): Promise<void> => {
      if (!file || !file.type || !file.type.startsWith('image/')) return;
      try {
        const src = await readBlobAsDataUrl(file);
        addItem({ id: uid(), src, name: file.name || '' });
      } catch (e) {
        console.error('addFromFile failed', e);
      }
    },
    [addItem]
  );

  const addFromUrl = useCallback(
    async (url: string): Promise<void> => {
      try {
        const r = await fetch(url, { mode: 'cors' });
        if (!r.ok) throw new Error('http ' + r.status);
        const blob = await r.blob();
        if (!blob.type || !blob.type.startsWith('image/')) throw new Error('not image');
        const src = await readBlobAsDataUrl(blob);
        addItem({ id: uid(), src, name: '' });
      } catch {
        // CORS / network fallback — добавляем напрямую URL
        addItem({ id: uid(), src: url, name: '' });
      }
    },
    [addItem]
  );

  // ===== Drag & Drop =====
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragover(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragover(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragover(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length) {
      for (const f of Array.from(dt.files)) await addFromFile(f);
      return;
    }
    const uri = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (uri) {
      uri.split(/\r?\n/).forEach((u) => {
        const trimmed = u.trim();
        if (trimmed && trimmed[0] !== '#') addFromUrl(trimmed);
      });
      return;
    }
    const html = dt.getData('text/html');
    if (html) {
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) addFromUrl(m[1]);
    }
  };

  // ===== Upload =====
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) await addFromFile(f);
    e.target.value = '';
  };

  // ===== Lightbox =====
  const openLightbox = (index: number) => setLbIndex(index);
  const closeLightbox = () => setLbIndex(-1);
  const navigate = useCallback(
    (delta: number) => {
      setLbIndex((i) => {
        if (items.length === 0) return -1;
        return (i + delta + items.length) % items.length;
      });
    },
    [items.length]
  );

  const handleLightboxDelete = () => {
    const it = items[lbIndex];
    if (!it) return;
    const newItems = items.filter((x) => x.id !== it.id);
    setItems(newItems);
    if (newItems.length === 0) {
      setLbIndex(-1);
    } else {
      setLbIndex(lbIndex % newItems.length);
    }
  };

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (lbIndex === -1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') navigate(-1);
      else if (e.key === 'ArrowRight') navigate(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lbIndex, navigate]);

  // Global Ctrl+V handler (paste anywhere on page)
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const cd = e.clipboardData;
      if (!cd) return;
      for (const it of Array.from(cd.items)) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) await addFromFile(f);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFromFile]);

  const lbItem = lbIndex >= 0 && lbIndex < items.length ? items[lbIndex] : null;
  const single = items.length <= 1;

  return (
    <>
      <div className="page">
        <section className="product">
          {/* Левая колонка: галерея */}
          <div className="gallery">
            <div className="gallery-toolbar">
              <button type="button" className="btn btn--secondary" onClick={handleUploadClick}>
                <UploadIcon />
                Загрузить
              </button>
            </div>

            <div
              className={`gallery-area${isDragover ? ' is-dragover' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={`gallery-empty${items.length > 0 ? ' is-hidden' : ''}`}>
                <PhotoIcon />
                <p>Перетащите фото сюда, нажмите Ctrl+V для вставки или загрузите с компьютера</p>
              </div>
              <div className="gallery-grid">
                {items.map((it, idx) => (
                  <div key={it.id} className="gallery-item" data-id={it.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.src}
                      alt=""
                      onClick={() => openLightbox(idx)}
                    />
                    <button
                      type="button"
                      className="gallery-delete"
                      aria-label="Удалить"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(it.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </div>

          {/* Правая колонка: форма */}
          <div className="form">
            <h1 className="form-title">Описание товара</h1>

            <div className="form-row">
              <label className="form-label" htmlFor="short-desc">
                Заголовок
              </label>
              <input
                className="form-input"
                type="text"
                id="short-desc"
                name="short_description"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="long-desc">
                Описание
              </label>
              <textarea
                className="form-textarea"
                id="long-desc"
                name="long_description"
                rows={6}
                value={longDesc}
                onChange={(e) => setLongDesc(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="price">
                Цена, €
              </label>
              <div className="price-field">
                <input
                  className="form-input"
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                />
                <span className="price-symbol" aria-hidden="true">
                  €
                </span>
              </div>
            </div>

            <div className="form-row">
              <span className="form-label">Доступные размеры</span>
              <div className="sizes-grid" role="group" aria-label="Доступные размеры">
                {SIZE_OPTIONS.map((size) => {
                  const isActive = selectedSizes.has(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      className={`size-chip${isActive ? ' is-active' : ''}`}
                      onClick={() => toggleSize(size)}
                      aria-pressed={isActive}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="actions">
              {mode === 'email' ? (
                <button
                  type="button"
                  className="btn"
                  id="btn-email"
                  onClick={handleSend}
                  disabled={sendStatus === 'loading'}
                >
                  {sendStatus === 'loading' ? <SpinnerIcon /> : <EmailIcon />}
                  {sendStatus === 'loading' ? 'Отправка…' : 'Отправить Email'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  id="btn-tg"
                  onClick={handleSend}
                  disabled={sendStatus === 'loading'}
                >
                  {sendStatus === 'loading' ? <SpinnerIcon /> : <TgIcon />}
                  {sendStatus === 'loading' ? 'Отправка…' : 'Отправить в TG'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <Toast
          key={toast.key}
          kind={toast.kind}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Lightbox */}
      {lbItem && (
        <div
          className="lightbox"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lightbox-img" src={lbItem.src} alt="" />
          <button
            type="button"
            className="lightbox-btn lightbox-close"
            aria-label="Закрыть"
            onClick={closeLightbox}
          >
            <CloseIcon />
          </button>
          <button
            type="button"
            className="lightbox-btn lightbox-delete"
            aria-label="Удалить"
            onClick={handleLightboxDelete}
          >
            <TrashIcon />
          </button>
          {!single && (
            <>
              <button
                type="button"
                className="lightbox-btn lightbox-prev"
                aria-label="Предыдущее"
                onClick={() => navigate(-1)}
              >
                <ChevLeftIcon />
              </button>
              <button
                type="button"
                className="lightbox-btn lightbox-next"
                aria-label="Следующее"
                onClick={() => navigate(1)}
              >
                <ChevRightIcon />
              </button>
            </>
          )}
          <span className="lightbox-counter">
            {lbIndex + 1} / {items.length}
          </span>
        </div>
      )}
    </>
  );
}

// ===== Inline SVG icon components =====

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L4 21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.95 4.4 18.7 19.7c-.24 1.08-.88 1.34-1.78.83l-4.92-3.62-2.37 2.28c-.26.26-.48.48-.99.48l.35-5.02 9.13-8.25c.4-.35-.09-.55-.61-.2L7.21 13.55l-4.86-1.52c-1.06-.33-1.08-1.06.22-1.57L20.6 3.05c.88-.33 1.65.2 1.36 1.35z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.24-8 5-8-5V6l8 5 8-5v2.24z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
