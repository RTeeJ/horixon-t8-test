import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom 30 has no <dialog> modal API. Minimal stand-in: `open` attribute, Esc closes,
// `close` event on close. Esc is listened for on `document` because user.keyboard fires on
// the active element, and this polyfill does not move focus into the dialog.
const escListeners = new WeakMap<HTMLDialogElement, (e: KeyboardEvent) => void>();
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    if (this.open) return;
    this.setAttribute('open', '');
    const onKey = (e: KeyboardEvent) => {
      // A dialog unmounted while open (test cleanup) must not react to later tests' keys.
      if (!this.isConnected) return document.removeEventListener('keydown', onKey);
      if (e.key === 'Escape') this.close();
    };
    escListeners.set(this, onKey);
    document.addEventListener('keydown', onKey);
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    const onKey = escListeners.get(this);
    if (onKey) document.removeEventListener('keydown', onKey);
    escListeners.delete(this);
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
