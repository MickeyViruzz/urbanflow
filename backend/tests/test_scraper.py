from etl.extractors.traffic_police import parse_notices

BASE_URL = "https://trafficpolice.example.gov.in"

FIXTURE = """
<html>
  <body>
    <ul class="notices">
      <li class="notice">
        <a href="/notices/2026/traffic-diversion-sv-road">Traffic diversion on SV Road near Bandra</a>
        <span class="date">05 Nov 2026</span>
        <p>Commuters should use the service road while the diversion remains in place.</p>
      </li>
      <li class="notice">
        <a href="/notices/2026/road-closure-andheri">Road closure for metro work at Andheri East</a>
        <span class="date">04 Nov 2026</span>
        <p>The road will remain closed for traffic during the overnight construction window.</p>
      </li>
      <li>
        <a href="/about">About the traffic police department</a>
      </li>
      <li>
        <a href="https://unrelated.example.com/road-closure">Road closure on another website</a>
      </li>
    </ul>
  </body>
</html>
"""


def test_scraper_parses_notice_links_and_metadata():
    notices = parse_notices(FIXTURE, BASE_URL)
    assert len(notices) == 2

    first = notices[0]
    assert first["source_url"] == (
        "https://trafficpolice.example.gov.in/notices/2026/traffic-diversion-sv-road"
    )
    assert first["title"] == "Traffic diversion on SV Road near Bandra"
    assert first["published_at"] is not None
    assert first["published_at"].year == 2026
    assert first["published_at"].month == 11
    assert first["location_name"] == "Bandra West"
    assert first["external_id"]
    assert first["summary"]
    assert first["status"] == "unknown"
    assert first["raw_payload"]["status_basis"] == "notice_listing"

    second = notices[1]
    assert "Road closure" in second["title"]
    assert second["location_name"] in {"Andheri East", "Andheri West"}
    assert all("another website" not in notice["title"] for notice in notices)


def test_scraper_respects_limit_and_returns_empty_for_unrelated_page():
    limited = parse_notices(FIXTURE, BASE_URL, limit=1)
    assert len(limited) == 1
    assert parse_notices("<html><body><a href='/about'>About</a></body></html>", BASE_URL) == []


def test_scraper_supports_numeric_dates_and_records_without_dates():
    html = """
    <html><body>
      <li>
        <a href="/notices/numeric">Road closure on a numbered date</a>
        <span>18/11/2025</span>
        <p>Commuters should avoid the stretch during repair work.</p>
      </li>
      <li>
        <a href="/notices/no-date">Traffic diversion without a listed date</a>
        <p>Use the parallel service road while the diversion is in place.</p>
      </li>
    </body></html>
    """
    notices = parse_notices(html, BASE_URL)
    by_url = {notice["source_url"].split("/")[-1]: notice for notice in notices}

    numeric = by_url["numeric"]
    assert numeric["published_at"] is not None
    assert numeric["published_at"].day == 18
    assert numeric["published_at"].month == 11
    assert numeric["status"] == "unknown"

    missing = by_url["no-date"]
    assert missing["published_at"] is None
    assert missing["start_time"] is None
    assert missing["status"] == "unknown"
    assert missing["raw_payload"]["date_basis"] == "collection_time"
    assert "No parseable publication date" in missing["description"]
