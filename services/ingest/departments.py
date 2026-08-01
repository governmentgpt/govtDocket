"""
Canonical Tamil Nadu department registry + resolver.

The graph clusters around ONE node per real department. Every adapter resolves
its department reference (a GO's dep_id name, a minister's portfolio, a scheme's
owning dept) through resolve() so they all point at the same `dept-<canonical>`
node — that's what turns scattered artifacts into department hubs.

The registry is a SEED, not a gate: an unknown department resolves to a
`new-<slug>` id (still a first-class hub) for the steward to approve or merge.
"""

import re

from slugify import slugify

# canonical_id -> (display name, [alias keywords])
CANONICAL = {
    "agriculture":     ("Agriculture and Farmers Welfare Department", ["agriculture", "farmers welfare"]),
    "animal-husbandry":("Animal Husbandry, Dairying, Fisheries and Fishermen Welfare Department", ["animal husbandry", "dairying", "fisheries", "fishermen"]),
    "bc-mbc":          ("BC, MBC and Minorities Welfare Department", ["bc mbc", "backward classes", "minorities welfare", "most backward"]),
    "commercial-taxes":("Commercial Taxes and Registration Department", ["commercial taxes", "registration"]),
    "cooperation":     ("Co-operation, Food and Consumer Protection Department", ["co operation", "cooperation", "food and consumer", "consumer protection", "civil supplies"]),
    "energy":          ("Energy Department", ["energy", "electricity", "power", "non conventional energy"]),
    "environment":     ("Environment, Climate Change and Forests Department", ["environment", "climate change", "forests", "pollution control"]),
    "finance":         ("Finance Department", ["finance", "planning and development", "planning"]),
    "handlooms":       ("Handlooms, Handicrafts, Textiles and Khadi Department", ["handlooms", "handicrafts", "textiles", "khadi"]),
    "health":          ("Health and Family Welfare Department", ["health", "family welfare", "medical education"]),
    "higher-education":("Higher Education Department", ["higher education", "technical education", "science and technology"]),
    "highways":        ("Highways and Minor Ports Department", ["highways", "minor ports"]),
    "home":            ("Home, Prohibition and Excise Department", ["home", "prohibition", "excise", "police", "prisons"]),
    "housing":         ("Housing and Urban Development Department", ["housing", "urban development"]),
    "hr-management":   ("Human Resources Management Department", ["human resources management", "personnel"]),
    "industries":      ("Industries, Investment Promotion and Commerce Department", ["industries", "investment promotion", "commerce"]),
    "it":              ("Information Technology and Digital Services Department", ["information technology", "digital services", "electronics"]),
    "labour":          ("Labour Welfare and Skill Development Department", ["labour", "skill development", "employment and training"]),
    "law":             ("Law Department", ["law", "courts", "legislative"]),
    "msme":            ("Micro, Small and Medium Enterprises Department", ["micro small and medium", "msme", "small industries"]),
    "municipal":       ("Municipal Administration and Water Supply Department", ["municipal administration", "water supply", "urban and water supply"]),
    "natural-resources":("Natural Resources Department", ["natural resources", "minerals", "mines"]),
    "public":          ("Public Department", ["public department", "general administration", "public general"]),
    "public-works":    ("Public Works Department", ["public works", "buildings", "pwd"]),
    "revenue":         ("Revenue and Disaster Management Department", ["revenue", "disaster management", "district revenue"]),
    "rural":           ("Rural Development and Panchayat Raj Department", ["rural development", "panchayat", "panchayats", "irrigation"]),
    "school-education":("School Education Department", ["school education", "archaeology", "tamil development", "information and publicity"]),
    "social-justice":  ("Social Justice Department", ["social justice", "adi dravidar", "tribal welfare"]),
    "social-welfare":  ("Social Welfare and Women Empowerment Department", ["social welfare", "women empowerment", "child development"]),
    "spi":             ("Special Programme Implementation Department", ["special programme implementation", "special initiatives"]),
    "tamil-development":("Tamil Development and Information Department", ["tamil development", "tamil dev", "information department"]),
    "tourism":         ("Tourism, Culture and Religious Endowments Department", ["tourism", "culture", "religious endowments"]),
    "transport":       ("Transport Department", ["transport"]),
    "water-resources": ("Water Resources Department", ["water resources", "irrigation projects"]),
    "differently-abled":("Welfare of Differently Abled Persons Department", ["differently abled", "welfare of differently abled"]),
    "youth-sports":    ("Youth Welfare and Sports Development Department", ["youth welfare", "sports development", "sports"]),
    "chief-minister":  ("Chief Minister's Office", ["chief minister", "cmo"]),
}


def _norm(s):
    s = (s or "").lower()
    s = re.sub(r"\bdepartment\b", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def resolve(name):
    """Return (dept_node_id, display_name). Known → canonical; unknown → pending slug."""
    n = _norm(name)
    if not n:
        return "dept-unknown", "Unknown Department"
    for cid, (display, aliases) in CANONICAL.items():
        if n == _norm(display):
            return f"dept-{cid}", display
    for cid, (display, aliases) in CANONICAL.items():
        for a in aliases:
            if a in n or n in a:
                return f"dept-{cid}", display
    return f"dept-new-{slugify(name)[:40]}", name.strip()


def dept_node(name):
    """Build a canonical department node (for upsert)."""
    node_id, display = resolve(name)
    return {
        "id": node_id, "type": "department",
        "title_en": display, "title_ta": display,
        "summary_en": f"{display} — Government of Tamil Nadu.",
        "summary_ta": f"{display} — தமிழ்நாடு அரசு.",
        "details_en": ["Government of Tamil Nadu department."],
        "details_ta": ["தமிழ்நாடு அரசுத் துறை."],
        "aliases": [{"alias": display, "lang": "EN"}, {"alias": name.strip(), "lang": "EN"}],
    }
