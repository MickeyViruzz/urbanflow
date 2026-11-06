"""Explainable text analytics for Mumbai traffic notices.

The classifier is a TF-IDF + linear SVM model trained on a small, labelled
notice corpus that ships with the repository. Transparent keyword rules act as
a guardrail for obvious notices and as a fallback if scikit-learn is missing.
Location extraction uses a curated Mumbai gazetteer (a deterministic named
entity approach) and summarisation is extractive, so every output can be
explained during an evaluation.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from functools import lru_cache

from bs4 import BeautifulSoup

from .gazetteer import extract_locations

CATEGORIES = [
    "Accident",
    "Road Closure",
    "Construction",
    "Traffic Diversion",
    "Public Event",
    "Parking Restriction",
    "Other",
]

FALLBACK_STOPWORDS = {
    "a",
    "about",
    "above",
    "after",
    "again",
    "against",
    "all",
    "also",
    "am",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "because",
    "been",
    "before",
    "being",
    "below",
    "between",
    "both",
    "but",
    "by",
    "can",
    "could",
    "did",
    "do",
    "does",
    "doing",
    "down",
    "during",
    "each",
    "few",
    "for",
    "from",
    "further",
    "had",
    "has",
    "have",
    "having",
    "he",
    "her",
    "here",
    "hers",
    "herself",
    "him",
    "himself",
    "his",
    "how",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "itself",
    "just",
    "me",
    "more",
    "most",
    "my",
    "myself",
    "no",
    "nor",
    "not",
    "now",
    "of",
    "off",
    "on",
    "once",
    "only",
    "or",
    "other",
    "our",
    "ours",
    "ourselves",
    "out",
    "over",
    "own",
    "same",
    "she",
    "should",
    "so",
    "some",
    "such",
    "than",
    "that",
    "the",
    "their",
    "theirs",
    "them",
    "themselves",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "to",
    "too",
    "under",
    "until",
    "up",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "whom",
    "why",
    "will",
    "with",
    "would",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves",
}

# (title, notice body, category) — a compact labelled corpus kept in-repo so
# training is reproducible and requires no external model download.
TRAINING_DATA: list[tuple[str, str, str]] = [
    ("Two-vehicle collision on SV Road", "Two cars collided near the SV Road junction, leaving one lane partially blocked. Traffic police have reached the spot.", "Accident"),
    ("Bike skids near Bandra station", "A two-wheeler skidded on a wet patch near Bandra station. Slow movement reported on the southbound carriageway.", "Accident"),
    ("Truck overturns on Eastern Express Highway", "A truck overturned near Vikhroli, blocking two lanes. Emergency crews are clearing the vehicle.", "Accident"),
    ("Minor accident at Sion Circle", "A collision between a taxi and a bus was reported at Sion Circle. No injuries were reported; traffic is moving slowly.", "Accident"),
    ("Hit-and-run case near Dadar TT", "Police are investigating a hit-and-run incident that disrupted traffic near Dadar TT circle this morning.", "Accident"),
    ("Car breakdown blocks flyover lane", "A stalled car is blocking the left lane of the Andheri flyover. Commuters are advised to approach with caution.", "Accident"),
    ("Road closed for Ganesh immersion", "The road will remain closed for traffic during the immersion procession. Commuters should use the designated alternate route.", "Road Closure"),
    ("Full closure on LBS Marg", "LBS Marg is closed for traffic between Kurla and Vidyavihar due to emergency repair work until tomorrow evening.", "Road Closure"),
    ("Night closure at Marine Drive", "A section of Marine Drive will be shut for traffic between 11 pm and 5 am for maintenance.", "Road Closure"),
    ("Southbound lane closed near Worli", "The southbound lane of the sea face road is closed for vehicular movement following an oil spill.", "Road Closure"),
    ("Road blocked by fallen tree", "A fallen tree has blocked the road near Powai garden. The road closure is expected to last two hours.", "Road Closure"),
    ("No entry at Fort junction", "The junction at Fort is closed to private vehicles during the event. Buses will follow a diverted route.", "Road Closure"),
    ("Resurfacing work on Link Road", "Road resurfacing work will be carried out on Link Road near Malad for the next three nights. One lane will remain closed.", "Construction"),
    ("Metro construction at Andheri East", "Metro rail construction activity is ongoing near Andheri East station. Motorists should expect narrow lanes.", "Construction"),
    ("Pipeline repair on Juhu Tara Road", "Water pipeline repair work has started on Juhu Tara Road. The work is scheduled to finish by Sunday.", "Construction"),
    ("Flyover repair near Sion", "Structural repair work on the Sion flyover continues. Two lanes are barricaded for construction.", "Construction"),
    ("Road work at BKC junction", "Utility construction work at the BKC junction is causing slow traffic. Use the service road where possible.", "Construction"),
    ("Pothole repair on Western Express Highway", "A road repair crew is fixing potholes on the Western Express Highway near Goregaon.", "Construction"),
    ("Diversion in place for Metro work", "Vehicular traffic will be diverted through the service road because of metro construction near Marol.", "Construction"),
    ("Traffic diverted at Dadar circle", "Traffic has been diverted from the main road to the parallel lane following a road cave-in.", "Traffic Diversion"),
    ("Diversion announced for procession", "A traffic diversion will be in place around the procession route from 4 pm onwards. Heavy vehicles should take the bypass.", "Traffic Diversion"),
    ("Alternate route advised at Chembur", "Commuters heading to Chembur are advised to use the alternate route via the Eastern Express Highway.", "Traffic Diversion"),
    ("One-way diversion near Colaba", "Vehicles are being rerouted in a one-way loop near Colaba Causeway while the road is repaired.", "Traffic Diversion"),
    ("Heavy vehicles diverted from Sea Link", "Heavy vehicles have been diverted away from the Bandra-Worli Sea Link during the maintenance window.", "Traffic Diversion"),
    ("Rally causes route diversion", "A political rally has led to a temporary diversion on the route between Byculla and Mazgaon.", "Traffic Diversion"),
    ("Ganesh procession route announced", "The festival procession will pass through Dadar and Matunga. Expect road closures and heavy footfall during the public event.", "Public Event"),
    ("Marathon causes road restrictions", "The city marathon will pass through Marine Lines, Fort and Churchgate. Several roads will be restricted for the event.", "Public Event"),
    ("Public gathering at Azad Maidan", "A large public gathering at Azad Maidan is expected to affect traffic on nearby roads through the afternoon.", "Public Event"),
    ("Idol immersion arrangements at Juhu", "Idol immersion arrangements at Juhu beach will draw crowds; traffic restrictions will be in force on approach roads.", "Public Event"),
    ("Protest march near Mantralaya", "A protest march near Mantralaya is likely to cause congestion. Commuters should plan for delays.", "Public Event"),
    ("No parking on Horniman Circle", "Parking is prohibited on Horniman Circle for the event. Vehicles found parked will be towed.", "Parking Restriction"),
    ("Parking restriction near Colaba market", "A no-parking restriction is in force on the approach road to Colaba market until Saturday evening.", "Parking Restriction"),
    ("Towing drive at Bandra station", "The traffic police are towing vehicles parked in the restricted zone outside Bandra station.", "Parking Restriction"),
    ("Pay and park closed at Powai", "The pay-and-park facility near Powai plaza will remain closed during the road work.", "Parking Restriction"),
    ("No parking along SV Road", "No-parking rules will be enforced along SV Road during the evening peak hours this week.", "Parking Restriction"),
    ("Waterlogging at Sion Circle", "Heavy rain has caused waterlogging at Sion Circle. Traffic is moving slowly and the underpass is partially blocked.", "Other"),
    ("Signal failure at Kurla junction", "A signal failure at the Kurla junction is causing congestion in all directions. Manual traffic control is in place.", "Other"),
    ("Tree falls near Powai Lake", "A tree has fallen near Powai Lake and is obstructing the left lane. A crew has been called to clear it.", "Other"),
    ("Potholes slow traffic in Malad", "Several potholes are slowing traffic on the service road near Malad. Two-wheelers should ride with caution.", "Other"),
    ("Cattle on road near Aarey", "Cattle wandering on the road near Aarey are causing intermittent slowdowns. Drive carefully.", "Other"),
    ("Vehicle fire at Wadala", "A vehicle fire near Wadala has been extinguished. Traffic is being regulated while the road is cleared.", "Other"),
    ("Water pipelines burst at Parel", "A burst water pipeline at Parel has left the road surface damaged and partially blocked.", "Other"),
    ("Sinkhole opens in Andheri", "A small sinkhole has opened on the road in Andheri West. Barricades have been placed around the spot.", "Other"),
    ("Road cave-in near Vile Parle", "A portion of the road caved in near Vile Parle following pipeline work. Motorists are advised to avoid the lane.", "Other"),
    ("Delayed clearance after collision", "A minor collision near Marine Lines was cleared after thirty minutes. Residual traffic is easing.", "Accident"),
    ("Pedestrian collision at Ghatkopar", "A pedestrian was struck near Ghatkopar station. One lane is cordoned off while police attend the scene.", "Accident"),
    ("Bus breakdown on LBS Marg", "A stalled city bus near Vidyavihar is blocking the left lane. Expect slow traffic towards Kurla.", "Other"),
    ("Overnight closure for girder launch", "The road will be closed overnight for a girder launch at the metro construction site near Bhandup.", "Construction"),
    ("Diverted traffic due to gas pipeline", "A gas pipeline repair has forced a traffic diversion around the affected stretch in Jogeshwari.", "Traffic Diversion"),
    ("No parking order for festival", "No-parking restrictions will apply on the roads around the festival venue in Vashi this weekend.", "Parking Restriction"),
    ("Charity run in South Mumbai", "A charity run will use roads around Marine Lines and Churchgate on Sunday morning, with rolling closures.", "Public Event"),
    ("Tanker incident near Sewri", "A tanker has broken down near Sewri, causing traffic to move slowly towards Wadala.", "Other"),
    ("Speed restriction during resurfacing", "A speed restriction is in place during resurfacing work on the link road near Chembur.", "Construction"),
    ("Crowd at Siddhivinayak junction", "Heavy crowds visiting the temple are causing congestion at the junction. Police are managing the inflow.", "Public Event"),
    ("Closure for emergency water main work", "The lane will be closed for emergency water main work near Byculla until early morning.", "Road Closure"),
    ("Multi-vehicle pile-up on highway", "A multi-vehicle pile-up on the highway near Panvel has reduced traffic to one lane.", "Accident"),
    ("Wrong-side entry blocked", "A police barricade is blocking wrong-side entry near Sion, causing a short detour for two-wheelers.", "Road Closure"),
    ("Construction material on carriageway", "Construction material has been left on the carriageway near Bhandup, leaving one lane blocked.", "Construction"),
    ("Protest blocks arterial road", "A local protest is blocking an arterial road near Mulund. Buses are being diverted.", "Public Event"),
    ("Night-time noise barrier work", "Noise barrier installation will require a lane closure on the flyover approach near Andheri East.", "Construction"),
    ("Parking zone suspended for repairs", "The pay-and-park zone at Bandra West is suspended while the surface is repaired.", "Parking Restriction"),
    ("Crane movement causes temporary hold", "A crane movement near Mahim has led to a temporary hold on traffic in both directions.", "Traffic Diversion"),
]

CATEGORY_RULES: dict[str, tuple[str, ...]] = {
    "Accident": (
        "accident",
        "collision",
        "collided",
        "crash",
        "hit-and-run",
        "hit and run",
        "overturned",
        "skidded",
        "pile-up",
        "pedestrian struck",
    ),
    "Road Closure": (
        "road closure",
        "road closed",
        "closed for traffic",
        "closed to traffic",
        "closure",
        "closed",
        "shut for traffic",
        "blocked",
        "blockade",
        "no entry",
        "cordoned",
    ),
    "Construction": (
        "construction",
        "resurfacing",
        "repair work",
        "repair",
        "maintenance",
        "metro work",
        "flyover work",
        "pipeline work",
        "road work",
        "digging",
        "barricaded",
        "girder",
        "pothole",
        "utility work",
    ),
    "Traffic Diversion": (
        "diversion",
        "diverted",
        "alternate route",
        "alternative route",
        "rerouted",
        "re-routed",
        "one-way",
        "detour",
    ),
    "Public Event": (
        "procession",
        "festival",
        "rally",
        "marathon",
        "visarjan",
        "immersion",
        "public event",
        "gathering",
        "protest",
        "crowd",
        "charity run",
        "run will use roads",
    ),
    "Parking Restriction": (
        "no-parking",
        "no parking",
        "parking restriction",
        "parking prohibited",
        "towed",
        "towing",
        "parking zone",
        "pay-and-park",
        "pay and park",
    ),
    "Other": (
        "waterlogging",
        "waterlogged",
        "signal failure",
        "tree falls",
        "fallen tree",
        "sinkhole",
        "cave-in",
        "cattle",
        "vehicle fire",
        "breakdown",
        "stalled",
        "fog",
        "oil spill",
        "slow traffic",
    ),
}


@lru_cache(maxsize=1)
def _stopwords() -> set[str]:
    try:
        from nltk.corpus import stopwords  # type: ignore

        return set(stopwords.words("english"))
    except Exception:
        return FALLBACK_STOPWORDS


@lru_cache(maxsize=1)
def _tokenizer():
    try:
        from nltk.tokenize import TreebankWordTokenizer  # type: ignore

        return TreebankWordTokenizer().tokenize
    except Exception:
        return lambda text: re.findall(r"[a-z0-9']+", text.lower())


def strip_html(value: str) -> str:
    if not value:
        return ""
    if "<" not in value and "&" not in value:
        return normalize_whitespace(value)
    text = BeautifulSoup(value, "html.parser").get_text(" ")
    return normalize_whitespace(text)


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def clean_text(value: str) -> str:
    text = strip_html(value)
    text = text.replace("\u00a0", " ")
    text = re.sub(r"https?://\S+", " ", text)
    return normalize_whitespace(text)


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in _tokenizer()(text) if token.strip()]


def remove_stopwords(tokens: list[str]) -> list[str]:
    stops = _stopwords()
    return [token for token in tokens if token.isalpha() and token not in stops]


def keyword_scores(text: str) -> dict[str, int]:
    lowered = text.lower()
    scores: dict[str, int] = {}
    for category, keywords in CATEGORY_RULES.items():
        scores[category] = sum(1 for keyword in keywords if keyword in lowered)
    return scores


def rule_category(text: str) -> tuple[str | None, int]:
    scores = keyword_scores(text)
    best_category = max(scores, key=lambda category: scores[category])
    best_score = scores[best_category]
    return (best_category, best_score) if best_score > 0 else (None, 0)


@lru_cache(maxsize=1)
def _model():
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.svm import LinearSVC

        corpus = [f"{title} {body}" for title, body, _ in TRAINING_DATA]
        labels = [category for _, _, category in TRAINING_DATA]
        stops = sorted(_stopwords())
        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words=stops,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
        )
        features = vectorizer.fit_transform(corpus)
        classifier = LinearSVC(C=1.0, class_weight="balanced", max_iter=4000)
        classifier.fit(features, labels)
        return vectorizer, classifier
    except Exception:  # pragma: no cover - sklearn is a required dependency
        return None


def classify_incident(title: str, description: str = "") -> tuple[str, float, str]:
    """Classify an incident, returning (category, confidence, method)."""
    text = clean_text(f"{title} {description}")
    if not text:
        return "Other", 0.0, "default"

    rule_label, rule_score = rule_category(text)
    model = _model()
    if model is None:
        return (rule_label or "Other"), (0.5 if rule_label else 0.0), "rules"

    vectorizer, classifier = model
    features = vectorizer.transform([text])
    margins = classifier.decision_function(features)[0]
    if hasattr(margins, "__len__"):
        max_margin = max(float(value) for value in margins)
        exps = [math.exp(float(value) - max_margin) for value in margins]
        total = sum(exps)
        best_index = max(range(len(exps)), key=lambda index: exps[index])
        ml_label = str(classifier.classes_[best_index])
        ml_confidence = round(exps[best_index] / total, 3) if total else 0.0
    else:
        ml_label = str(classifier.classes_[0])
        ml_confidence = 0.0

    if rule_label and rule_score >= 2:
        return rule_label, 0.75, "keyword rules"
    if rule_label and ml_confidence < 0.35:
        return rule_label, max(0.45, ml_confidence), "keyword fallback"
    if rule_label and ml_label == rule_label:
        return ml_label, max(ml_confidence, 0.5), "tfidf+svm"
    return ml_label, ml_confidence, "tfidf+svm"


def classify_text(title: str, description: str = "") -> str:
    return classify_incident(title, description)[0]


def extract_location_entities(text: str) -> list[str]:
    return [place.name for place in extract_locations(text)]


def summarize(text: str, max_sentences: int = 2, max_chars: int = 280) -> str:
    cleaned = clean_text(text)
    if not cleaned:
        return ""
    sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", cleaned) if sentence.strip()]
    if len(sentences) <= max_sentences:
        result = " ".join(sentences)
        return result[: max_chars - 1].rstrip() + "…" if len(result) > max_chars else result

    tokens = remove_stopwords(tokenize(cleaned))
    frequencies = Counter(tokens)
    if frequencies:
        top_frequency = max(frequencies.values())
        for word in frequencies:
            frequencies[word] /= top_frequency

    scores: list[tuple[float, int, str]] = []
    for index, sentence in enumerate(sentences):
        words = remove_stopwords(tokenize(sentence))
        if not words:
            continue
        score = sum(frequencies.get(word, 0.0) for word in words) / (len(words) ** 0.5)
        if index == 0:
            score += 0.25
        scores.append((score, index, sentence))

    chosen = sorted(scores, key=lambda item: item[0], reverse=True)[:max_sentences]
    chosen.sort(key=lambda item: item[1])
    summary = " ".join(sentence for _, _, sentence in chosen)
    if len(summary) > max_chars:
        summary = summary[: max_chars - 1].rstrip() + "…"
    return summary
