#!/usr/bin/env python3
"""Finalize domain-dependent SEO URLs and generate sitemap.xml.

Example (run after `node build_locales.js`):
    python3 generate_sitemap.py --base-url https://your-domain.example

This updates absolute canonicals, reciprocal hreflang tags, Open Graph/Twitter image URLs,
robots.txt, and a 52-URL sitemap. It deliberately requires the real public HTTPS domain.
"""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
LANGUAGES = ("ru", "en", "fr", "de")
PAGE_FILES = {
    "home": "index.html",
    "prayers": "prayers.html",
    "practices": "practices.html",
    "wheel": "wheel.html",
    "traditions": "traditions/index.html",
    "prayerWheel": "prayer-wheel/index.html",
    "mantras": "mantras/index.html",
    "prayerFlags": "prayer-flags/index.html",
    "buddhistPrayer": "buddhist-prayer/index.html",
    "offerings": "offerings/index.html",
    "number108": "108/index.html",
    "tibetanBuddhism": "tibetan-buddhism/index.html",
    "meditation": "meditation/index.html",
}
PAGE_ROUTES = {
    "home": "",
    "prayers": "prayers.html",
    "practices": "practices.html",
    "wheel": "wheel.html",
    "traditions": "traditions/",
    "prayerWheel": "prayer-wheel/",
    "mantras": "mantras/",
    "prayerFlags": "prayer-flags/",
    "buddhistPrayer": "buddhist-prayer/",
    "offerings": "offerings/",
    "number108": "108/",
    "tibetanBuddhism": "tibetan-buddhism/",
    "meditation": "meditation/",
}
IMAGE_PATH = "assets/prayer-wheel-hero.jpg"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def normalize_base_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or not parsed.netloc:
        raise argparse.ArgumentTypeError("Use the public HTTPS URL, e.g. https://example.org")
    if parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise argparse.ArgumentTypeError("The base URL must not contain credentials, a query, or a fragment")
    path = parsed.path.rstrip("/") + "/"
    return urlunparse(("https", parsed.netloc, path, "", "", ""))


def route_path(language: str, page: str) -> str:
    prefix = "" if language == "ru" else f"{language}/"
    suffix = PAGE_ROUTES[page]
    return prefix + suffix


def page_file(language: str, page: str) -> Path:
    directory = ROOT if language == "ru" else ROOT / language
    return directory / PAGE_FILES[page]


def absolute_url(base_url: str, path: str) -> str:
    return urljoin(base_url, path)


def replace_tag_attribute(tag: str, name: str, value: str) -> str:
    escaped = html.escape(str(value), quote=True)
    pattern = re.compile(rf'(?<![\w:-]){re.escape(name)}\s*=\s*(["\'])(.*?)\1', re.IGNORECASE | re.DOTALL)
    if pattern.search(tag):
        return pattern.sub(lambda match: f'{name}="{escaped}"', tag, count=1)
    return tag[:-1] + f' {name}="{escaped}">'


def upsert_link(document: str, rel: str, attributes: dict[str, str]) -> str:
    pattern = re.compile(
        rf'<link\b(?=[^>]*\brel\s*=\s*(["\']){re.escape(rel)}\1)[^>]*>',
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(document)
    if match:
        tag = match.group(0)
        for name, value in attributes.items():
            tag = replace_tag_attribute(tag, name, value)
        return document[:match.start()] + tag + document[match.end():]
    tag = '<link rel="' + html.escape(rel, quote=True) + '"'
    for name, value in attributes.items():
        tag += f' {name}="{html.escape(str(value), quote=True)}"'
    tag += '>'
    return insert_in_head(document, tag)


def upsert_meta(document: str, selector: str, key: str, content: str) -> str:
    pattern = re.compile(
        rf'<meta\b(?=[^>]*\b{re.escape(selector)}\s*=\s*(["\']){re.escape(key)}\1)[^>]*>',
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(document)
    if match:
        tag = replace_tag_attribute(match.group(0), "content", content)
        return document[:match.start()] + tag + document[match.end():]
    tag = f'<meta {selector}="{html.escape(key, quote=True)}" content="{html.escape(content, quote=True)}">'
    return insert_in_head(document, tag)


def insert_in_head(document: str, markup: str) -> str:
    match = re.search(r'</head\s*>', document, re.IGNORECASE)
    if not match:
        raise ValueError("Could not find </head> in an HTML page")
    return document[:match.start()] + f'  {markup}\n' + document[match.start():]


def hreflang_block(base_url: str, page: str) -> str:
    rows = []
    for language in LANGUAGES:
        href = absolute_url(base_url, route_path(language, page))
        rows.append(f'<link rel="alternate" hreflang="{language}" href="{html.escape(href, quote=True)}">')
    default_url = absolute_url(base_url, route_path("ru", page))
    rows.append(f'<link rel="alternate" hreflang="x-default" href="{html.escape(default_url, quote=True)}">')
    return '<!-- seo-hreflang:start -->\n  ' + '\n  '.join(rows) + '\n  <!-- seo-hreflang:end -->'


def update_hreflang(document: str, base_url: str, page: str) -> str:
    block = hreflang_block(base_url, page)
    managed = re.compile(r'\s*<!-- seo-hreflang:start -->[\s\S]*?<!-- seo-hreflang:end -->\s*', re.IGNORECASE)
    if managed.search(document):
        return managed.sub('\n  ' + block + '\n', document, count=1)
    return insert_in_head(document, block)


def finalize_page(language: str, page: str, base_url: str) -> str:
    file_path = page_file(language, page)
    if not file_path.exists():
        raise FileNotFoundError(f"Expected page is missing: {file_path}. Run node build_locales.js first.")
    document = file_path.read_text(encoding="utf-8")
    canonical = absolute_url(base_url, route_path(language, page))
    image_url = absolute_url(base_url, IMAGE_PATH)

    document = upsert_link(document, "canonical", {"href": canonical})
    document = update_hreflang(document, base_url, page)
    document = upsert_meta(document, "property", "og:url", canonical)
    document = upsert_meta(document, "property", "og:image", image_url)
    document = upsert_meta(document, "name", "twitter:image", image_url)
    document = upsert_meta(document, "name", "twitter:card", "summary_large_image")
    file_path.write_text(document, encoding="utf-8")
    return canonical


def write_sitemap(base_url: str) -> Path:
    ET.register_namespace("", SITEMAP_NS)
    urlset = ET.Element(f"{{{SITEMAP_NS}}}urlset")
    locations = []
    for language in LANGUAGES:
        for page in PAGE_FILES:
            location = absolute_url(base_url, route_path(language, page))
            entry = ET.SubElement(urlset, f"{{{SITEMAP_NS}}}url")
            ET.SubElement(entry, f"{{{SITEMAP_NS}}}loc").text = location
            locations.append(location)
    ET.indent(urlset, space="  ")
    sitemap_path = ROOT / "sitemap.xml"
    sitemap_path.write_bytes(
        b'<?xml version="1.0" encoding="UTF-8"?>\n'
        + ET.tostring(urlset, encoding="utf-8")
        + b"\n"
    )
    return sitemap_path


def update_robots(base_url: str) -> Path:
    robots_path = ROOT / "robots.txt"
    lines = robots_path.read_text(encoding="utf-8").splitlines()
    lines = [line for line in lines if not line.strip().lower().startswith("sitemap:")
             and "Add a Sitemap:" not in line]
    while lines and not lines[-1].strip():
        lines.pop()
    lines.extend(["", f"Sitemap: {absolute_url(base_url, 'sitemap.xml')}"])
    robots_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return robots_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, type=normalize_base_url,
                        help="Public HTTPS site URL, with no page path")
    args = parser.parse_args()

    canonicals = []
    for language in LANGUAGES:
        for page in PAGE_FILES:
            canonicals.append(finalize_page(language, page, args.base_url))
    sitemap_path = write_sitemap(args.base_url)
    robots_path = update_robots(args.base_url)

    print(f"Finalized SEO URLs on {len(canonicals)} pages.")
    print(f"Created {sitemap_path}")
    print(f"Added Sitemap directive to {robots_path}")


if __name__ == "__main__":
    main()
