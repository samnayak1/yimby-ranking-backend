from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Query parameters that only say where a click came from. Dropping them is what
# lets the same article, linked from two places, be recognised as already seen.
_TRACKING_PARAMS = {"fbclid", "gclid", "mc_cid", "mc_eid", "cid", "ref", "ref_src", "cmpid", "taid"}
_TRACKING_PREFIXES = ("utm_",)
_DEFAULT_PORTS = {"http": 80, "https": 443}


def normalize_url(url: str) -> str:
    """Canonical form of an article URL: no fragment, no tracking parameters,
    lower-case host, no default port, no trailing slash, sorted query."""
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()

    host = (parts.hostname or "").lower()
    if parts.port and parts.port != _DEFAULT_PORTS.get(scheme):
        host = f"{host}:{parts.port}"

    path = parts.path or "/"
    if len(path) > 1:
        path = path.rstrip("/")

    query = urlencode(sorted(
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in _TRACKING_PARAMS and not k.lower().startswith(_TRACKING_PREFIXES)
    ))

    return urlunsplit((scheme, host, path, query, ""))


def is_http_url(url: str) -> bool:
    parts = urlsplit(url)
    return parts.scheme in ("http", "https") and bool(parts.hostname)
