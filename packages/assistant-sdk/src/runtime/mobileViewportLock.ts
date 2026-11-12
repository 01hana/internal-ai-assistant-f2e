type InlineProperty = "overflow" | "position" | "top" | "left" | "width";
type SavedProperty = { value: string; priority: string };

const owners = new Set<string>();
let savedBody: Map<InlineProperty, SavedProperty> | null = null;
let savedHtmlOverflow: SavedProperty | null = null;
let savedScrollY = 0;

function saveProperty(style: CSSStyleDeclaration, property: InlineProperty): SavedProperty {
  return { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) };
}

function restoreProperty(style: CSSStyleDeclaration, property: InlineProperty, saved: SavedProperty) {
  if (saved.value) style.setProperty(property, saved.value, saved.priority);
  else style.removeProperty(property);
}

export function acquireMobileViewportLock(owner: string) {
  if (typeof document === "undefined" || owners.has(owner)) return;
  if (owners.size === 0) {
    const body = document.body;
    const html = document.documentElement;
    savedBody = new Map<InlineProperty, SavedProperty>(
      (["overflow", "position", "top", "left", "width"] as const).map(property => [property, saveProperty(body.style, property)]),
    );
    savedHtmlOverflow = saveProperty(html.style, "overflow");
    savedScrollY = window.scrollY;
    html.style.setProperty("overflow", "hidden");
    body.style.setProperty("overflow", "hidden");
    body.style.setProperty("position", "fixed");
    body.style.setProperty("top", `${-savedScrollY}px`);
    body.style.setProperty("left", "0");
    body.style.setProperty("width", "100%");
  }
  owners.add(owner);
}

export function releaseMobileViewportLock(owner: string) {
  if (typeof document === "undefined" || !owners.delete(owner) || owners.size > 0) return;
  const body = document.body;
  const html = document.documentElement;
  for (const [property, saved] of savedBody ?? []) {
    restoreProperty(body.style, property, saved);
  }
  if (savedHtmlOverflow) restoreProperty(html.style, "overflow", savedHtmlOverflow);
  const scrollY = savedScrollY;
  savedBody = null;
  savedHtmlOverflow = null;
  savedScrollY = 0;
  if (scrollY !== 0) window.scrollTo(window.scrollX, scrollY);
}
