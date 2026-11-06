"""Mumbai Traffic Police public notices scraper (BeautifulSoup).

The source site is not consistently reachable from automated environments. The
collector therefore fails gracefully, records the failure in collection_logs,
and never fabricates records. Robots.txt is checked before requesting pages.
The pipeline's reliable alternatives are OpenStreetMap roadworks and Open-Meteo
weather, both of which are integrated and attributed.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from app.config import settings
from etl.gazetteer import IST, extract_locations
from etl.normalize import clean_web_text
from etl.nlp import summarize


class ExtractionError(RuntimeError):
    pass


class RobotsDenied(ExtractionError):
    pass


DATE_PATTERNS = (
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
    re.compile(
        r"\b\d{1,2}[\s/-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
        r"[a-z]*[\s/-]\d{2,4}\b",
        re.IGNORECASE,
    ),
)


def extract_notice_date(text: str) -> datetime | None:
    """Extract common Indian notice date formats, using day-first for numeric dates."""
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        try:
            parsed = date_parser.parse(match.group(0), dayfirst=True, fuzzy=True)
        except (ValueError, OverflowError):
            continue
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=IST)
        return parsed.astimezone(IST)
    return None


def _robots_allowed(base_url: str) -> bool:
    parsed = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    try:
        response = requests.get(
            robots_url,
            timeout=10,
            headers={"User-Agent": settings.http_user_agent},
        )
    except requests.RequestException:
        # Do not scrape when the robots policy cannot be verified.
        return False
    if response.status_code == 404:
        return True
    if response.status_code >= 400:
        return False
    parser.parse(response.text.splitlines())
    return parser.can_fetch(settings.http_user_agent, base_url)


def parse_notices(html: str, base_url: str, limit: int = 30) -> list[dict]:
    """Parse a notices listing page. Kept pure so the scraper is testable offline."""
    soup = BeautifulSoup(html, "html.parser")
    notices: list[dict] = []
    seen_urls: set[str] = set()
    keywords = re.compile(
        r"(traffic\s+(police\s+)?(diversion|notice|advisory|restriction|update|alert)|"
        r"road\s+(closure|closed|work|repair|construction|diversion|restriction)|"
        r"construction|accident|diversion|closure|waterlogg|procession|marathon|"
        r"parking\s+(restriction|prohibition))",
        re.IGNORECASE,
    )
    navigation = re.compile(
        r"^(about|contact|home|login|register|tenders?|recruitment|downloads?|sitemap|"
        r"privacy|terms)\b",
        re.IGNORECASE,
    )

    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "").strip()
        title = clean_web_text(anchor.get_text(" ", strip=True))
        if (
            not href
            or len(title) < 12
            or not keywords.search(title)
            or navigation.search(title)
        ):
            continue
        url = urljoin(base_url, href)
        if url in seen_urls or urlparse(url).netloc != urlparse(base_url).netloc:
            continue
        seen_urls.add(url)
        parent_text = clean_web_text(anchor.parent.get_text(" ", strip=True))
        description = parent_text if len(parent_text) > len(title) + 20 else title
        published = extract_notice_date(parent_text)
        collected_at = datetime.now(tz=IST)
        if published is None:
            description = (
                f"{description} No parseable publication date was present in the listing; "
                f"this record was collected on {collected_at.date().isoformat()} and its "
                "operational status is unconfirmed."
            )
        places = extract_locations(f"{title} {description}")
        primary_place = next(
            (place for place in places if place.kind == "locality"),
            places[0] if places else None,
        )
        notices.append(
            {
                "external_id": hashlib.sha256(url.encode("utf-8")).hexdigest()[:32],
                "title": title[:300],
                "description": description,
                "summary": summarize(description),
                "location_name": primary_place.name if primary_place else None,
                # The listing date is a publication date, not a confirmed start date.
                # Without structured validity dates the operational status is unknown.
                "start_time": published,
                "published_at": published,
                "status": "unknown",
                "source_url": url,
                "raw_payload": {
                    "listing_url": base_url,
                    "date_basis": "listing_date" if published else "collection_time",
                    "status_basis": "notice_listing",
                },
            }
        )
        if len(notices) >= limit:
            break
    return notices


def fetch_notices(limit: int = 30) -> list[dict]:
    base_url = settings.traffic_police_url
    if not _robots_allowed(base_url):
        raise RobotsDenied(
            "robots.txt policy could not be verified or disallows automated collection"
        )

    try:
        response = requests.get(
            base_url,
            timeout=20,
            headers={
                "User-Agent": settings.http_user_agent,
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        response.raise_for_status()
    except requests.RequestException as error:
        raise ExtractionError(f"Traffic police site unavailable: {error}") from error

    notices = parse_notices(response.text, base_url, limit=limit)
    if not notices:
        raise ExtractionError(
            "Site responded but no notice records could be parsed; layout may have changed"
        )
    return notices
