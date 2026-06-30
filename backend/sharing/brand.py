"""Brand tokens for the share card, mirrored 1:1 from the frontend so the unfurl
preview matches the live app exactly:
  - status colors  -> frontend/src/statuses.ts (fallback palette)
  - priority meta  -> frontend/src/types.ts PRIORITY_META
  - surfaces       -> frontend/src/index.css (:root light theme)
Keep these in sync if the design system moves (DESIGN-DECISIONS-LOG is the tie-breaker).
"""

# Light "cream" surface — the card is a raster image, so it uses ONE theme.
BG = (246, 239, 222)        # --bg  #f6efde
SURFACE = (255, 253, 248)   # --surface #fffdf8
BORDER = (228, 216, 187)    # --border #e4d8bb
INK = (35, 38, 43)          # --text #23262b
MUTED = (90, 97, 114)       # --muted #5a6172
FAINT = (138, 130, 112)     # --faint #8a8270
NAVY = (30, 58, 110)        # primary #1e3a6e
GOLD = (201, 162, 75)       # --gold #c9a24b
WHITE = (255, 255, 255)

# Status key -> (label, hex color). Matches statuses.ts fallback palette.
STATUS = {
    "todo": ("To Do", "#6b7280"),
    "in_progress": ("In Progress", "#2c64a8"),
    "delayed": ("Delayed", "#bb3b28"),
    "review": ("Review", "#7a5aa6"),
    "done": ("Done", "#3f7d54"),
}

# Priority level (1-5) -> (label, hex color). Matches PRIORITY_META.
PRIORITY = {
    1: ("Lowest", "#64748b"),
    2: ("Low", "#3b82a8"),
    3: ("Medium", "#b7791f"),
    4: ("High", "#c2762a"),
    5: ("Highest", "#b4452f"),
}

# Priority chevron polylines (14×14 viewBox) — mirror the app's PriorityIcon:
# double-up=Highest, up=High, equals=Medium, down=Low, double-down=Lowest.
PRIORITY_CHEVRON = {
    5: ["2,11 7,6 12,11", "2,7 7,2 12,7"],
    4: ["2,9 7,4 12,9"],
    3: ["3,5 11,5", "3,9 11,9"],
    2: ["2,5 7,10 12,5"],
    1: ["2,3 7,8 12,3", "2,7 7,12 12,7"],
}


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    """Parse a #rrggbb string to RGB. A malformed/empty value (a stray DB color)
    falls back to NAVY rather than 500-ing the public card path."""
    h = (h or "").strip().lstrip("#")
    if len(h) != 6:
        return NAVY
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return NAVY
