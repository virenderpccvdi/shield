import re
from typing import List, Set


_keyword_store: dict[str, Set[str]] = {}


def set_keywords(profile_id: str, keywords: List[str]) -> None:
    _keyword_store[profile_id] = {kw.lower().strip() for kw in keywords}


def get_keywords(profile_id: str) -> List[str]:
    return list(_keyword_store.get(profile_id, set()))


def check_domain(profile_id: str, domain: str) -> List[str]:
    """Returns list of matched keywords for the given domain."""
    kws = _keyword_store.get(profile_id, set())
    domain_lower = domain.lower()
    return [kw for kw in kws if kw in domain_lower]
