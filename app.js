(() => {
'use strict';

const $ = id => document.getElementById(id);

/* ========================================================================
   Small helpers
   ======================================================================== */
const MIME = {
  css:'text/css', js:'text/javascript', mjs:'text/javascript', json:'application/json', txt:'text/plain',
  html:'text/html', htm:'text/html', svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
  gif:'image/gif', webp:'image/webp', avif:'image/avif', ico:'image/x-icon', bmp:'image/bmp', cur:'image/x-icon',
  woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf', eot:'application/vnd.ms-fontobject',
  mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', m4a:'audio/mp4', mp4:'video/mp4', webm:'video/webm',
  wasm:'application/wasm'
};
const ext = p => { const m = /\.([a-z0-9]+)$/i.exec(p.split('#')[0].split('?')[0]); return m ? m[1].toLowerCase() : ''; };
const dirname = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
const kb = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';

function normPath(p){
  const out = [];
  for(const seg of p.split('/')){
    if(seg === '' || seg === '.') continue;
    if(seg === '..'){ out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
}
function cleanRef(ref){
  let r = ref.split('#')[0].split('?')[0];
  try{ r = decodeURIComponent(r); }catch(e){}
  return r;
}
function classify(ref){
  const r = (ref || '').trim();
  if(!r || r.startsWith('#')) return 'skip';
  if(/^(data|blob|about|javascript|mailto|tel):/i.test(r)) return 'skip';
  if(/^(https?:)?\/\//i.test(r)) return 'remote';
  if(/^[a-z][a-z0-9+.\-]*:/i.test(r)) return 'skip';
  return 'local';
}

/* ---- text encoding sniff for the main page (utf-8 unless it says otherwise) ---- */
function decodeHtml(buf){
  const head = new TextDecoder('latin1').decode(buf.slice(0, 2048));
  const m = /<meta[^>]+charset\s*=\s*["']?\s*([\w\-]+)/i.exec(head);
  let label = 'utf-8';
  if(m){ label = m[1].toLowerCase(); }
  try{ return new TextDecoder(label).decode(buf); }
  catch(e){ return new TextDecoder('utf-8').decode(buf); }
}

/* ========================================================================
   State
   ======================================================================== */
let files = [];           // [{ path, file }]
let lastSvg = '';
let lastName = 'page';
let previewUrl = '';
let report = [];

const log = (kind, msg) => report.push({ kind, msg });

/* ========================================================================
   Adding files (drop, pick, folder)
   ======================================================================== */
const SKIP_DIR = /(^|\/)(\.git|node_modules)(\/|$)/i;

function addFile(path, file){
  path = path.replace(/^\/+/, '');
  if(SKIP_DIR.test(path)) return;
  files = files.filter(f => f.path !== path);
  files.push({ path, file });
}

function walkEntry(entry){
  return new Promise(resolve => {
    if(entry.isFile){
      entry.file(f => { addFile(entry.fullPath, f); resolve(); }, () => resolve());
    } else if(entry.isDirectory){
      const reader = entry.createReader();
      const all = [];
      const readMore = () => reader.readEntries(async batch => {
        if(!batch.length){
          for(const e of all) await walkEntry(e);
          resolve();
        } else { all.push(...batch); readMore(); }
      }, () => resolve());
      readMore();
    } else resolve();
  });
}

const drop = $('drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', async e => {
  // everything from the drop has to be read right now, before anything is awaited
  const dt = e.dataTransfer;
  const items = dt && dt.items ? Array.from(dt.items) : [];
  const entries = items.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  const plain = dt ? Array.from(dt.files) : [];
  if(entries.length){
    for(const en of entries) await walkEntry(en);
  } else {
    plain.forEach(f => addFile(f.name, f));
  }
  refreshFiles();
});

$('btnFiles').addEventListener('click', () => $('pickFiles').click());
$('btnFolder').addEventListener('click', () => $('pickFolder').click());
$('pickFiles').addEventListener('change', e => {
  Array.from(e.target.files).forEach(f => addFile(f.name, f));
  e.target.value = '';
  refreshFiles();
});
$('pickFolder').addEventListener('change', e => {
  Array.from(e.target.files).forEach(f => addFile(f.webkitRelativePath || f.name, f));
  e.target.value = '';
  refreshFiles();
});

const isPage = p => /\.html?$/i.test(p);

function refreshFiles(){
  const pages = files.filter(f => isPage(f.path));
  const others = files.length - pages.length;
  const info = $('fileInfo');
  info.hidden = files.length === 0;
  info.innerHTML = files.length
    ? `<b>${pages.length}</b> page${pages.length === 1 ? '' : 's'} and <b>${others}</b> other file${others === 1 ? '' : 's'} ready`
    : '';

  const sel = $('mainSel');
  const prev = sel.value;
  sel.innerHTML = '';
  // best guess for the main page: index.html, then the one closest to the top
  const ranked = pages.slice().sort((a, b) => {
    const ai = /(^|\/)index\.html?$/i.test(a.path) ? 0 : 1, bi = /(^|\/)index\.html?$/i.test(b.path) ? 0 : 1;
    return ai - bi || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path);
  });
  ranked.forEach(p => { const o = document.createElement('option'); o.value = p.path; o.textContent = p.path; sel.appendChild(o); });
  if(prev && ranked.some(p => p.path === prev)) sel.value = prev;
  $('mainRow').hidden = ranked.length < 2;
  updateButtons();
}

function updateButtons(){
  const ready = files.some(f => isPage(f.path)) || $('paste').value.trim() !== '';
  $('btnConvert').disabled = !ready;
}
$('paste').addEventListener('input', updateButtons);
$('optFit').addEventListener('change', () => { $('fixedBox').hidden = $('optFit').value !== 'fixed'; });

/* ========================================================================
   Finding + loading the resources a page points to
   ======================================================================== */
let opts = { local: true, remote: true };
let index = new Map();      // lowercase path -> entry
let byName = new Map();     // lowercase file name -> [entries]
let uriCache = new Map();   // resource label -> data uri

function buildIndex(){
  index = new Map(); byName = new Map();
  for(const f of files){
    index.set(normPath(f.path).toLowerCase(), f);
    const n = f.path.split('/').pop().toLowerCase();
    if(!byName.has(n)) byName.set(n, []);
    byName.get(n).push(f);
  }
}

function findLocal(ref, baseDir){
  const cleaned = cleanRef(ref);
  const target = normPath(cleaned.startsWith('/') ? cleaned : baseDir + cleaned);
  const hit = index.get(target.toLowerCase());
  if(hit) return hit;
  const name = target.split('/').pop().toLowerCase();
  const c = byName.get(name) || [];
  if(c.length === 1){ log('info', `matched "${ref}" to ${c[0].path} by file name`); return c[0]; }
  return null;
}

async function loadRemote(url, wantText){
  try{
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    return {
      blob,
      text: wantText ? await blob.text() : undefined,
      mime: MIME[ext(url)] || ct || 'application/octet-stream',
      base: { kind: 'remote', url: res.url || url },
      label: url
    };
  }catch(err){
    log('warn', `kept as an online link (could not download): ${url} (${err.message})`);
    return null;
  }
}

// returns { blob, text?, mime, base, label } or null (null = leave the reference as it is)
async function load(ref, base, wantText){
  const kind = classify(ref);
  if(kind === 'skip') return null;

  if(kind === 'remote'){
    if(!opts.remote) return null;
    return loadRemote(ref.startsWith('//') ? 'https:' + ref : ref, wantText);
  }

  // relative reference
  if(base.kind === 'remote'){
    if(!opts.remote) return null;
    let abs;
    try{ abs = new URL(ref, base.url).href; }catch(e){ return null; }
    return loadRemote(abs, wantText);
  }
  if(!opts.local) return null;
  const entry = findLocal(ref, base.dir);
  if(!entry){
    log('warn', `not found: "${ref}" (drop that file too, or it stays a broken link)`);
    return null;
  }
  return {
    blob: entry.file,
    text: wantText ? await entry.file.text() : undefined,
    mime: MIME[ext(entry.path)] || entry.file.type || 'application/octet-stream',
    base: { kind: 'local', dir: dirname(entry.path) },
    label: entry.path
  };
}

function blobToDataUri(blob, mime){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, `data:${mime};base64,`));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

// resolve a reference to a data: uri (or null to keep it as is)
async function dataUriFor(ref, base){
  const res = await load(ref, base, false);
  if(!res) return null;
  if(uriCache.has(res.label)) return uriCache.get(res.label);
  const uri = await blobToDataUri(res.blob, res.mime);
  uriCache.set(res.label, uri);
  stats.files++;
  stats.bytes += res.blob.size;
  return uri;
}

/* ========================================================================
   CSS: @import and url(...) get packed in
   ======================================================================== */
async function processUrls(css, base){
  const re = /url\(\s*(['"]?)([^'")]*?)\1\s*\)/gi;
  const found = [];
  let m;
  while((m = re.exec(css))){ found.push({ start: m.index, end: re.lastIndex, ref: m[2] }); }
  if(!found.length) return css;
  let out = '', last = 0;
  for(const f of found){
    out += css.slice(last, f.start);
    const uri = await dataUriFor(f.ref, base);
    out += uri ? `url("${uri}")` : css.slice(f.start, f.end);
    last = f.end;
  }
  return out + css.slice(last);
}

async function processCss(css, base, depth = 0){
  const re = /@import\s+(?:url\(\s*(['"]?)([^'")\s]+)\1\s*\)|(['"])([^'"]+)\3)([^;]*);/gi;
  const imports = [];
  let m;
  while((m = re.exec(css))){ imports.push({ start: m.index, end: re.lastIndex, ref: m[2] || m[4], tail: (m[5] || '').trim() }); }

  let out = '', last = 0;
  for(const imp of imports){
    out += await processUrls(css.slice(last, imp.start), base);
    const original = css.slice(imp.start, imp.end);
    let replacement = original;
    const plainTail = !imp.tail || !/^(layer|supports)\b/i.test(imp.tail);
    if(depth < 6 && plainTail){
      const res = await load(imp.ref, base, true);
      if(res){
        let inner = await processCss(res.text.replace(/@charset\s+["'][^"']*["']\s*;/i, ''), res.base, depth + 1);
        replacement = imp.tail ? `@media ${imp.tail}{${inner}}` : inner;
        stats.css++;
        log('ok', `packed in @import ${res.label}`);
      }
    }
    out += replacement;
    last = imp.end;
  }
  out += await processUrls(css.slice(last), base);
  return out;
}

/* ========================================================================
   The page itself
   ======================================================================== */
let stats = { css: 0, js: 0, media: 0, files: 0, bytes: 0 };

// keep script text from ending its own <script> tag or opening an html comment
const safeScript = code => code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!\-\-/g, '<\\!--');

async function inlinePage(text, mainPath){
  const doc = new DOMParser().parseFromString(text, 'text/html');
  let changed = false;

  let base = { kind: 'local', dir: dirname(mainPath) };
  const baseEl = doc.querySelector('base[href]');
  if(baseEl){
    const bh = baseEl.getAttribute('href');
    const k = classify(bh);
    if(k === 'remote') base = { kind: 'remote', url: bh.startsWith('//') ? 'https:' + bh : bh };
    else if(k === 'local') base = { kind: 'local', dir: normPath(dirname(mainPath) + bh) + (normPath(dirname(mainPath) + bh) ? '/' : '') };
  }

  // 1) <link> tags: stylesheets become <style>, icons become data uris
  for(const link of Array.from(doc.querySelectorAll('link[rel][href]'))){
    const rels = link.getAttribute('rel').toLowerCase().split(/\s+/);
    const href = link.getAttribute('href');
    if(rels.includes('stylesheet')){
      const res = await load(href, base, true);
      if(!res) continue;
      const style = doc.createElement('style');
      const media = link.getAttribute('media');
      if(media) style.setAttribute('media', media);
      style.textContent = await processCss(res.text, res.base);
      link.replaceWith(style);
      stats.css++; stats.files++; stats.bytes += res.blob.size; changed = true;
      log('ok', `packed in stylesheet ${res.label}`);
    } else if(rels.some(r => r === 'icon' || r === 'apple-touch-icon' || r === 'apple-touch-icon-precomposed' || r === 'mask-icon')){
      const uri = await dataUriFor(href, base);
      if(uri){ link.setAttribute('href', uri); stats.media++; changed = true; log('ok', `packed in icon ${href}`); }
    }
  }

  // 2) <style> blocks and style="" attributes
  for(const st of Array.from(doc.querySelectorAll('style'))){
    const before = st.textContent;
    if(!/url\(|@import/i.test(before)) continue;
    const after = await processCss(before, base);
    if(after !== before){ st.textContent = after; changed = true; }
  }
  for(const el of Array.from(doc.querySelectorAll('[style]'))){
    const before = el.getAttribute('style');
    if(!/url\(/i.test(before)) continue;
    const after = await processUrls(before, base);
    if(after !== before){ el.setAttribute('style', after); changed = true; }
  }

  // 3) scripts
  const deferred = [];
  for(const s of Array.from(doc.querySelectorAll('script[src]'))){
    const src = s.getAttribute('src');
    const res = await load(src, base, true);
    if(!res) continue;
    const type = (s.getAttribute('type') || '').toLowerCase();
    if(type === 'module' && /(^|[;\n\s])(import|export)\b[^;\n]*\bfrom\s*['"]|import\s*\(/.test(res.text)){
      log('warn', `${res.label} is a module that imports other files; those imports can't be packed in`);
    }
    s.removeAttribute('src'); s.removeAttribute('integrity'); s.removeAttribute('crossorigin');
    s.textContent = safeScript(res.text);
    if(s.hasAttribute('defer') && type !== 'module'){ s.removeAttribute('defer'); s.removeAttribute('async'); deferred.push(s); }
    else { s.removeAttribute('defer'); s.removeAttribute('async'); }
    stats.js++; stats.files++; stats.bytes += res.blob.size; changed = true;
    log('ok', `packed in script ${res.label}`);
  }
  // a deferred script runs after the page is parsed, so it goes to the end, in order
  deferred.forEach(s => doc.body.appendChild(s));

  // 4) images, audio, video, icons inside the page
  const single = [
    ['img', 'src'], ['source', 'src'], ['video', 'src'], ['video', 'poster'], ['audio', 'src'],
    ['track', 'src'], ['embed', 'src'], ['object', 'data'], ['input[type="image"]', 'src'],
    ['image', 'href'], ['image', 'xlink:href']
  ];
  for(const [sel, attr] of single){
    for(const el of Array.from(doc.querySelectorAll(sel))){
      const val = el.getAttribute(attr);
      if(!val) continue;
      const uri = await dataUriFor(val, base);
      if(uri){ el.setAttribute(attr, uri); stats.media++; changed = true; log('ok', `packed in ${val}`); }
    }
  }
  for(const el of Array.from(doc.querySelectorAll('img[srcset], source[srcset]'))){
    const parts = el.getAttribute('srcset').split(/,\s+(?=\S)/);
    let touched = false;
    const rebuilt = [];
    for(const part of parts){
      const [u, ...desc] = part.trim().split(/\s+/);
      const uri = u ? await dataUriFor(u, base) : null;
      if(uri){ touched = true; rebuilt.push([uri, ...desc].join(' ')); } else rebuilt.push(part.trim());
    }
    if(touched){ el.setAttribute('srcset', rebuilt.join(', ')); stats.media++; changed = true; }
  }
  for(const fr of Array.from(doc.querySelectorAll('iframe[src]'))){
    const v = fr.getAttribute('src');
    if(classify(v) === 'local' && opts.local && findLocal(v, base.kind === 'local' ? base.dir : '')){
      log('warn', `iframe ${v} is a separate page; convert it on its own (it is not packed in)`);
    }
  }

  const dt = /^\s*(?:<!--[\s\S]*?-->\s*)*(<!doctype[^>]*>)/i.exec(text);
  const html = changed ? (dt ? dt[1] + '\n' : '') + doc.documentElement.outerHTML : text;
  return { html, changed, title: (doc.title || '').trim() };
}

/* ========================================================================
   Building the svg
   ======================================================================== */
// characters XML can never contain (even escaped), and lone surrogates
const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
function xmlSafe(s){
  const before = s.length;
  s = s.replace(XML_BAD, '').replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, (m, pair) => pair ? m : '');
  if(s.length !== before) log('warn', `removed ${before - s.length} character(s) that svg/xml cannot hold`);
  return s;
}
// attribute values in xml lose their line breaks and tabs, so those are written out as codes
const attrEscape = s => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;');
const textEscape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildSvg(html, { title, fixed, w, h }){
  const size = fixed ? `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"` : 'width="100%" height="100%"';
  const box  = fixed ? `x="0" y="0" width="${w}" height="${h}"` : 'x="0" y="0" width="100%" height="100%"';
  const label = title || 'page';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- made with html to svg. open this file directly in a browser. -->
<svg xmlns="http://www.w3.org/2000/svg" ${size}>
  <title>${textEscape(xmlSafe(label))}</title>
  <foreignObject ${box}>
    <iframe xmlns="http://www.w3.org/1999/xhtml" title="${attrEscape(xmlSafe(label))}" style="display:block;width:100%;height:100%;border:0;margin:0;padding:0;background:transparent" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write; web-share; accelerometer; gyroscope" allowfullscreen="true" srcdoc="${attrEscape(xmlSafe(html))}"></iframe>
  </foreignObject>
</svg>
`;
}

/* ========================================================================
   Convert button
   ======================================================================== */
function renderReport(){
  const ul = $('report');
  ul.innerHTML = '';
  report.forEach(r => {
    const li = document.createElement('li');
    li.className = r.kind;
    li.textContent = r.msg;
    ul.appendChild(li);
  });
}

async function convert(){
  report = [];
  stats = { css: 0, js: 0, media: 0, files: 0, bytes: 0 };
  uriCache = new Map();
  opts = { local: $('optLocal').checked, remote: $('optRemote').checked };
  $('btnConvert').disabled = true;
  $('summary').hidden = true;
  $('btnDownload').disabled = true;
  $('btnPreview').disabled = true;
  $('previewCard').hidden = true;
  $('report').innerHTML = '<li class="info">working…</li>';

  try{
    let text, mainPath;
    const pasted = $('paste').value;
    if(pasted.trim()){
      text = pasted; mainPath = 'pasted.html'; lastName = 'page';
    } else {
      const main = files.find(f => f.path === $('mainSel').value) || files.find(f => isPage(f.path));
      if(!main) throw new Error('add an html file first');
      text = decodeHtml(await main.file.arrayBuffer());
      mainPath = main.path;
      lastName = main.path.split('/').pop().replace(/\.html?$/i, '') || 'page';
    }
    buildIndex();

    const res = await inlinePage(text, mainPath);
    if(!/^\s*(?:<!--[\s\S]*?-->\s*)*<!doctype/i.test(text)){
      log('warn', 'this page has no <!DOCTYPE html> at the top. browsers open such pages in "quirks mode", but inside an svg they always use standards mode, so a few layouts can shift slightly. adding <!DOCTYPE html> as the first line of your page makes both identical.');
    }
    if(!res.changed) log('info', 'the page was kept exactly as written' + (files.length > 1 || opts.remote ? ' (nothing needed packing in)' : ''));

    const fixed = $('optFit').value === 'fixed';
    const w = Math.max(100, parseInt($('optW').value, 10) || 1280);
    const h = Math.max(100, parseInt($('optH').value, 10) || 720);
    lastSvg = buildSvg(res.html, { title: res.title || lastName, fixed, w, h });
    window.lastSvg = lastSvg;      // handy for testing

    const parts = [];
    if(stats.css) parts.push(stats.css + ' stylesheet' + (stats.css === 1 ? '' : 's'));
    if(stats.js) parts.push(stats.js + ' script' + (stats.js === 1 ? '' : 's'));
    if(stats.media) parts.push(stats.media + ' image/media file' + (stats.media === 1 ? '' : 's'));
    const inSize = new Blob([text]).size, outSize = new Blob([lastSvg]).size;
    $('summary').hidden = false;
    $('summary').textContent = `done: ${kb(inSize)} html became a ${kb(outSize)} svg` + (parts.length ? ` (packed in ${parts.join(', ')})` : '');
    if(outSize > 25 * 1048576) log('warn', 'the svg is very large; some browsers may be slow to open it');
    $('btnDownload').disabled = false;
    $('btnPreview').disabled = false;
    if(!report.length) log('ok', 'converted');
  }catch(err){
    log('bad', err.message || String(err));
    lastSvg = '';
  }
  renderReport();
  updateButtons();
}

$('btnConvert').addEventListener('click', convert);

$('btnDownload').addEventListener('click', () => {
  if(!lastSvg) return;
  const url = URL.createObjectURL(new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = lastName + '.svg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

$('btnPreview').addEventListener('click', () => {
  if(!lastSvg) return;
  if(previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' }));
  $('preview').src = previewUrl;
  $('previewCard').hidden = false;
  $('previewCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

updateButtons();
})();
