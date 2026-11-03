export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = value;
    else if (key === 'disabled') node.disabled = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const paths = {
  plus: 'M12 5v14M5 12h14', frame: 'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3M7 7h10v10H7z',
  arrow: 'm5 3 14 9-7 1-3 7z', hand: 'M8 13V6a2 2 0 0 1 4 0v6-5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v7a5 5 0 0 1-5 5h-3a5 5 0 0 1-4-2L4 14a2 2 0 0 1 3-2l1 1',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  download: 'M12 3v13m-5-5 5 5 5-5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6',
  moon: 'M21 12.5A9 9 0 0 1 11.5 3 9 9 0 1 0 21 12.5',
  sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  image: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm-1 13 5-5 5 5 3-3 5 5M8 7h.01',
  folder: 'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  copy: 'M9 9h12v12H9zM15 9V3H3v12h6', history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  up: 'm6 15 6-6 6 6', down: 'm6 9 6 6 6-6', save: 'M4 3h13l4 4v14H3V3zm3 0v6h9V3M7 21v-8h10v8',
  more: 'M5 12h.01M12 12h.01M19 12h.01', sparkle: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
  compare: 'M12 3v18M8 5H3v14h5m8-14h5v14h-5', external: 'M14 3h7v7m0-7L10 14M9 3H3v18h18v-6'
};
export function icon(name, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k,v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k,v);
  const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', paths[name] || paths.frame); svg.append(p); return svg;
}
export function fileData(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('无法读取文件')); r.readAsDataURL(file); }); }
export async function loadImage(src) {
  const image = new Image(); image.decoding = 'async';
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('图片无法解码，请重新导出 PNG/JPEG')); image.src = src; });
  return image;
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob), a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function fileName(title, suffix) { return (title || 'screenshot-board').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 80) + suffix; }
export function readPref(key) { try { return localStorage.getItem('ssb.' + key); } catch { return null; } }
export function writePref(key, value) { try { localStorage.setItem('ssb.' + key, value); } catch { /* Preference storage is optional; board data lives on the host. */ } }
