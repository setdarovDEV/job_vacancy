const loading = new Map<string, Promise<void>>();

/**
 * Adds a third-party script once and resolves when it has loaded (Google sign-in,
 * Turnstile, gtag). A failed load is forgotten, so a later call tries again.
 */
export function loadScript(src: string): Promise<void> {
  let p = loading.get(src);
  if (p) return p;
  p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading.delete(src);
      s.remove();
      reject(new Error(`failed to load ${src}`));
    };
    document.head.appendChild(s);
  });
  loading.set(src, p);
  return p;
}
