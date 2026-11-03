/**
 * Spotify names audiobook episodes inconsistently, even within one series:
 * "208/Kelch des Schicksals", "071/Gefahr in den Ruinen" and "Folge 241: Meister des Lichts".
 * This brings them into one shape: "Folge 208: Kelch des Schicksals".
 */
export function episodeTitle(name: string): string {
  const title = name.trim();

  // "071/Title" → "Folge 71: Title"
  const numbered = title.match(/^0*(\d+)\s*\/\s*(.+)$/);
  if (numbered) return `Folge ${numbered[1]}: ${numbered[2]}`;

  // "Folge 007: Title" / "Folge 7 - Title" → "Folge 7: Title"
  const folge = title.match(/^Folge\s+0*(\d+)\s*[:\-–]\s*(.+)$/i);
  if (folge) return `Folge ${folge[1]}: ${folge[2]}`;

  // "Mini-Fall/Title (Mini-Fall 09)" → "Mini-Fall 9: Title"; "Adventskalender/Title" → "Adventskalender - Title"
  const prefixed = title.match(/^([^\s/\d][^\s/]*)\/(\S.*)$/);
  if (prefixed) {
    const [, prefix, rest] = prefixed;
    const counted = rest.match(new RegExp(`^(.+?)\\s*\\(${escapeRegExp(prefix)}\\s+0*(\\d+)\\)$`));
    if (counted) return `${prefix} ${counted[2]}: ${counted[1]}`;
    return `${prefix} - ${rest}`;
  }

  return title;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
