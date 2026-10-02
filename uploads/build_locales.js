#!/usr/bin/env node
/*
 * Build crawlable, localized HTML routes from the Russian source pages and locales.js.
 * The small tokenizer preserves original SVG and markup verbatim; it does not reserialize
 * the source HTML through a DOM library.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const pages = {
  home: 'index.html',
  prayers: 'prayers.html',
  practices: 'practices.html',
  wheel: 'wheel.html'
};
const languageCodes = ['en', 'fr', 'de'];
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const copyTags = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'label', 'small', 'figcaption', 'blockquote', 'span', 'strong', 'summary']);
const removedCopyClasses = new Set(['required-mark', 'brand-mark', 'counter-dot', 'counter-divider', 'caption-rule']);

const localeContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'locales.js'), 'utf8'), localeContext);
const locales = localeContext.window.SITE_TRANSLATIONS;

function makeNode(type, fields = {}) {
  return { type, children: [], ...fields };
}

function parseHtml(source) {
  const root = makeNode('root');
  const stack = [root];
  const tokenPattern = /<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+|</g;
  let match;
  while ((match = tokenPattern.exec(source))) {
    const token = match[0];
    const parent = stack[stack.length - 1];
    if (token.startsWith('<!--') || token.startsWith('<!') || token.startsWith('<?')) {
      parent.children.push(makeNode('raw', { raw: token }));
      continue;
    }
    if (token.startsWith('</')) {
      const nameMatch = token.match(/^<\/\s*([^\s>]+)/);
      if (!nameMatch) {
        parent.children.push(makeNode('raw', { raw: token }));
        continue;
      }
      const name = nameMatch[1].toLowerCase();
      let index = -1;
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tagName === name) { index = i; break; }
      }
      if (index >= 0) {
        stack[index].rawClose = token;
        stack.length = index;
      } else {
        parent.children.push(makeNode('raw', { raw: token }));
      }
      continue;
    }
    if (token.startsWith('<')) {
      const nameMatch = token.match(/^<\s*([^\s/>]+)/);
      if (!nameMatch) {
        parent.children.push(makeNode('raw', { raw: token }));
        continue;
      }
      const tagName = nameMatch[1].toLowerCase();
      const node = makeNode('tag', { tagName, rawOpen: token, rawClose: '' });
      parent.children.push(node);
      if (!voidTags.has(tagName) && !/\/\s*>$/.test(token)) stack.push(node);
      continue;
    }
    parent.children.push(makeNode('text', { raw: token }));
  }
  return root;
}

function decodeEntities(value) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1].toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
    return named[entity.toLowerCase()] || whole;
  });
}

function parseAttributes(node) {
  if (node._attributes) return node._attributes;
  const nameMatch = node.rawOpen.match(/^<\s*([^\s/>]+)/);
  const rest = node.rawOpen.slice(nameMatch ? nameMatch[0].length : 1).replace(/\/\s*>$/, '>');
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(rest))) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attributes[name] = decodeEntities(value);
  }
  node._attributes = attributes;
  return attributes;
}

function getAttr(node, name) {
  return parseAttributes(node)[name.toLowerCase()];
}

function escapeAttribute(value, quote) {
  let escaped = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (quote === '"') escaped = escaped.replace(/"/g, '&quot;');
  else escaped = escaped.replace(/'/g, '&#39;');
  return escaped;
}

function setAttr(node, name, value) {
  const pattern = new RegExp(`(\\s${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*=\\s*)(["'])(.*?)\\2`, 'i');
  if (pattern.test(node.rawOpen)) {
    node.rawOpen = node.rawOpen.replace(pattern, (_all, prefix, quote) => `${prefix}${quote}${escapeAttribute(value, quote)}${quote}`);
  } else {
    node.rawOpen = node.rawOpen.replace(/\s*\/?>$/, (end) => ` ${name}="${escapeAttribute(value, '"')}"${end}`);
  }
  node._attributes = null;
}

function allElements(root) {
  const output = [];
  const visit = (node) => {
    if (node.type === 'tag') output.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return output;
}

function hasClass(node, className) {
  return (getAttr(node, 'class') || '').split(/\s+/).includes(className);
}

function hasRemovedCopyMarker(node) {
  if (node.tagName === 'svg' || getAttr(node, 'aria-hidden') === 'true') return true;
  return [...removedCopyClasses].some((className) => hasClass(node, className));
}

function textContent(node, isRoot = false) {
  if (node.type === 'text') return decodeEntities(node.raw);
  if (node.type !== 'tag' && node.type !== 'root') return '';
  if (!isRoot && node.type === 'tag' && hasRemovedCopyMarker(node)) return '';
  if (node.type === 'tag' && node.tagName === 'br') return ' ';
  return node.children.map((child) => textContent(child)).join('');
}

function sourceKey(node) {
  return textContent(node, true).replace(/\s+/g, ' ').trim();
}

function matchesCopySelector(node) {
  return copyTags.has(node.tagName) || hasClass(node, 'art-kicker');
}

function collectCopyNodes(root) {
  const output = [];
  const visit = (node, inLanguageSwitch = false, inWheelVisual = false) => {
    if (node.type !== 'tag') {
      node.children.forEach((child) => visit(child, inLanguageSwitch, inWheelVisual));
      return;
    }
    const insideLanguageSwitch = inLanguageSwitch || hasClass(node, 'language-switch');
    const insideWheelVisual = inWheelVisual || hasClass(node, 'wheel-visual');
    const allowedWheelNode = !insideWheelVisual || hasClass(node, 'wheel-click-hint');
    if (!insideLanguageSwitch && allowedWheelNode && matchesCopySelector(node)) output.push(node);
    node.children.forEach((child) => visit(child, insideLanguageSwitch, insideWheelVisual));
  };
  root.children.forEach((child) => visit(child));
  return output;
}

function containsFormControl(node) {
  return node.children.some((child) => child.type === 'tag' && (
    ['input', 'select', 'textarea', 'button'].includes(child.tagName) || containsFormControl(child)
  ));
}

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseFragment(fragment) {
  return parseHtml(fragment).children;
}

function setPlainCopy(node, translation) {
  const preservesDecoration = node.children.some((child) => child.type === 'tag' && (
    getAttr(child, 'aria-hidden') === 'true' || child.tagName === 'svg'
    || hasClass(child, 'required-mark') || hasClass(child, 'eyebrow-line')
  ));
  if (!preservesDecoration) {
    node.children = [makeNode('text', { raw: escapeText(translation) })];
    return;
  }
  const directTextNodes = node.children.filter((child) => child.type === 'text');
  const firstText = directTextNodes.find((child) => decodeEntities(child.raw).trim());
  if (firstText) {
    firstText.raw = escapeText(translation);
    directTextNodes.forEach((child) => { if (child !== firstText) child.raw = ''; });
  } else {
    node.children = [makeNode('text', { raw: escapeText(translation) })];
  }
}

function updateCopy(root, translations) {
  const nodes = collectCopyNodes(root).map((node) => ({ node, key: sourceKey(node) }));
  for (const { node, key } of nodes) {
    if (!key || (node.tagName === 'label' && containsFormControl(node))) continue;
    const translation = translations[key];
    if (typeof translation !== 'string') continue;
    if (/<\/?[a-z][^>]*>/i.test(translation)) node.children = parseFragment(translation);
    else setPlainCopy(node, translation);
  }
}

function updateLocalizedAttributes(root, translations) {
  const elements = allElements(root);
  for (const node of elements) {
    for (const name of ['aria-label', 'alt', 'placeholder', 'title']) {
      const source = getAttr(node, name);
      if (source && typeof translations[source] === 'string') setAttr(node, name, translations[source]);
    }
  }
}

function findMeta(root, selectorName, selectorValue) {
  return allElements(root).find((node) => node.tagName === 'meta' && getAttr(node, selectorName) === selectorValue);
}

function setMeta(root, selectorName, selectorValue, content) {
  const node = findMeta(root, selectorName, selectorValue);
  if (node) setAttr(node, 'content', content);
}

function localizeHead(root, language, pageName, locale) {
  const elements = allElements(root);
  const html = elements.find((node) => node.tagName === 'html');
  if (html) setAttr(html, 'lang', language);
  const titleNode = elements.find((node) => node.tagName === 'title');
  const title = locale.title[pageName];
  const description = locale.description[pageName];
  if (titleNode && title) titleNode.children = [makeNode('text', { raw: escapeText(title) })];
  setMeta(root, 'name', 'description', description);
  setMeta(root, 'property', 'og:title', title);
  setMeta(root, 'property', 'og:description', description);
  setMeta(root, 'property', 'og:locale', { en: 'en_GB', fr: 'fr_FR', de: 'de_DE' }[language]);
  setMeta(root, 'property', 'og:site_name', { en: 'In the Circle', fr: 'Dans le cercle', de: 'Im Kreis' }[language]);
  setMeta(root, 'name', 'twitter:title', title);
  setMeta(root, 'name', 'twitter:description', description);
  const canonical = elements.find((node) => node.tagName === 'link' && (getAttr(node, 'rel') || '').split(/\s+/).includes('canonical'));
  if (canonical) setAttr(canonical, 'href', pageName === 'home' ? './' : pages[pageName]);
}

function rewriteAssetPaths(root) {
  for (const node of allElements(root)) {
    for (const name of ['href', 'src']) {
      const value = getAttr(node, name);
      if (!value) continue;
      let next = value;
      if (value === 'styles.css' || value === 'locales.js' || value === 'script.js') next = `../${value}`;
      else if (value.startsWith('assets/')) next = `../${value}`;
      if (next !== value) setAttr(node, name, next);
    }
  }
}

function render(node) {
  if (node.type === 'root') return node.children.map(render).join('');
  if (node.type === 'raw' || node.type === 'text') return node.raw;
  return `${node.rawOpen}${node.children.map(render).join('')}${node.rawClose || ''}`;
}

function main() {
  for (const language of languageCodes) {
    const locale = locales[language];
    if (!locale) throw new Error(`Missing locale ${language} in locales.js`);
    const outputDirectory = path.join(ROOT, language);
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const [pageName, filename] of Object.entries(pages)) {
      const source = fs.readFileSync(path.join(ROOT, filename), 'utf8');
      const document = parseHtml(source);
      updateCopy(document, locale.copy || {});
      updateLocalizedAttributes(document, locale.attrs || {});
      localizeHead(document, language, pageName, locale);
      rewriteAssetPaths(document);
      fs.writeFileSync(path.join(outputDirectory, filename), render(document));
    }
  }
  console.log('Generated 12 language-specific HTML pages under /en, /fr and /de.');
}

main();
