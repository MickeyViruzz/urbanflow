from etl.nlp import (
    classify_incident,
    classify_text,
    clean_text,
    extract_location_entities,
    remove_stopwords,
    strip_html,
    summarize,
    tokenize,
)


def test_strip_html_removes_markup():
    assert strip_html("<p>Road <b>closed</b> near Bandra.</p>") == "Road closed near Bandra."


def test_clean_text_normalises_whitespace_and_urls():
    cleaned = clean_text("  Road   closed <br/> due to work https://example.com  ")
    assert cleaned == "Road closed due to work"
    assert "  " not in cleaned


def test_tokenisation_and_stopword_removal():
    tokens = tokenize("The road closure near Bandra is reported")
    assert "road" in tokens and "closure" in tokens
    filtered = remove_stopwords(tokens)
    assert "the" not in filtered
    assert "road" in filtered


def test_transparent_classifier_handles_explicit_categories():
    cases = [
        ("Two-vehicle accident causes lane blockage near Sion", "Accident"),
        ("Road closed for traffic at LBS Marg", "Road Closure"),
        ("Metro construction work continues near Andheri East", "Construction"),
        ("Traffic diverted via service road near BKC", "Traffic Diversion"),
        ("Ganesh procession route in Dadar", "Public Event"),
        ("No-parking restriction on Hill Road", "Parking Restriction"),
        ("Waterlogging reported at Sion Circle", "Other"),
    ]
    for text, expected in cases:
        assert classify_text(text) == expected, text


def test_classification_returns_method_and_confidence():
    category, confidence, method = classify_incident(
        "Road closure on SV Road", "The road is closed for repair work near Bandra."
    )
    assert category == "Road Closure"
    assert 0 <= confidence <= 1
    assert method


def test_location_entities_use_gazetteer():
    entities = extract_location_entities("Road work near Bandra West and Worli sea face")
    assert "Bandra West" in entities
    assert "Worli" in entities


def test_extractive_summary_is_bounded():
    description = (
        "<p>One lane is blocked near Sion after a collision. "
        "Traffic police are clearing the vehicles. "
        "Commuters should use the parallel road. "
        "Expect delays through the morning peak.</p>"
    )
    summary = summarize(description, max_sentences=2, max_chars=160)
    assert summary
    assert len(summary) <= 160
    assert "<" not in summary
    assert summary == summarize(description, max_sentences=2, max_chars=160)
