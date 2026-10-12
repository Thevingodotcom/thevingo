import React, { useEffect, useRef, useState } from 'react';
import { haptics } from '../../../utils/haptics';
import { fetchDishImageSuggestions } from '../../../utils/imageSuggest';

const UploadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const SparkleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"></path>
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"></path>
  </svg>
);

const PlateIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5"></circle>
    <circle cx="12" cy="12" r="2.6"></circle>
    <path d="M4 7v3a1 1 0 0 0 2 0V7M5 7v10"></path>
    <path d="M20 17V7c-1.2.6-1.8 2.3-1.8 4.2 0 .8.6 1.2 1.2 1.2h.6"></path>
  </svg>
);

/**
 * Single "Choose image" control with preview, remove (x) and TheMealDB-powered
 * "Suggest image" picker. The native file input is visually hidden.
 */
function DishImageField({ previewSrc, dishName, disabled = false, onSelectFile, onPickUrl, onRemove }) {
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | done | empty | error | needs-name
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      haptics?.light?.();
      onSelectFile?.(file);
    }
    // Allow re-selecting the same file after removing it.
    e.target.value = '';
  };

  const handleSuggest = async () => {
    const name = (dishName || '').trim();
    if (!name) {
      setStatus('needs-name');
      setSuggestions([]);
      return;
    }
    haptics?.light?.();
    abortRef.current?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortRef.current = controller;
    setStatus('loading');
    setSuggestions([]);
    try {
      const results = await fetchDishImageSuggestions(name, { limit: 4, signal: controller?.signal });
      if (controller?.signal.aborted) return;
      setSuggestions(results);
      setStatus(results.length > 0 ? 'done' : 'empty');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setStatus('error');
    }
  };

  const handlePick = (url) => {
    haptics?.selection?.();
    onPickUrl?.(url);
  };

  return (
    <div className="menu-image-field">
      <div className="menu-image-row">
        <div className={`menu-image-preview ${previewSrc ? '' : 'is-empty'}`}>
          {previewSrc ? (
            <>
              <img src={previewSrc} alt="Dish preview" />
              <button
                type="button"
                className="menu-image-remove"
                onClick={() => {
                  haptics?.light?.();
                  onRemove?.();
                }}
                disabled={disabled}
                aria-label="Remove image"
                title="Remove image"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
              </button>
            </>
          ) : (
            <PlateIcon />
          )}
        </div>

        <div className="menu-image-actions">
          <button
            type="button"
            className="menu-image-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <UploadIcon />
            {previewSrc ? 'Change image' : 'Choose image'}
          </button>
          <button
            type="button"
            className="menu-image-btn menu-image-btn--ghost"
            onClick={handleSuggest}
            disabled={disabled || status === 'loading'}
            title="Find photos matching the dish name"
          >
            <SparkleIcon />
            {status === 'loading' ? 'Finding…' : 'Suggest image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="menu-visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </div>
      </div>

      {status === 'needs-name' && (
        <p className="menu-image-hint">Enter a dish name first to get image suggestions.</p>
      )}
      {status === 'empty' && <p className="menu-image-hint">No suggestions found</p>}
      {status === 'error' && (
        <p className="menu-image-hint is-error">Couldn't load suggestions. Check your connection and try again.</p>
      )}
      {status === 'loading' && (
        <div className="menu-image-suggestions" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className="menu-image-suggestion is-skeleton" />)}
        </div>
      )}
      {status === 'done' && suggestions.length > 0 && (
        <div className="menu-image-suggestions" role="list" aria-label="Suggested images">
          {suggestions.map((s) => (
            <button
              key={s.url}
              type="button"
              role="listitem"
              className={`menu-image-suggestion ${previewSrc === s.url ? 'is-selected' : ''}`}
              onClick={() => handlePick(s.url)}
              disabled={disabled}
              title={s.title}
              aria-label={`Use image: ${s.title}`}
            >
              <img src={s.url} alt={s.title} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DishImageField;
