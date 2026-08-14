const KNOWN_ACRONYMS = new Set(['ICT', 'PE', 'IT', 'STEM', 'AI', 'CAD', 'CAM', 'GIS', 'ESL'])

/**
 * Automatically formats a subject name to proper Title Case, preserving known acronyms.
 * E.g. "robotics" -> "Robotics", "advanced physics" -> "Advanced Physics", "ict" -> "ICT"
 */
export function formatSubjectName(input: string): string {
  const clean = input.trim()
  if (!clean) return ''

  return clean
    .split(/\s+/)
    .map(word => {
      const upper = word.toUpperCase()
      if (KNOWN_ACRONYMS.has(upper)) {
        return upper
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Calculate Levenshtein distance between two strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  const lenA = a.length
  const lenB = b.length

  for (let i = 0; i <= lenA; i++) matrix[i] = [i]
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[lenA][lenB]
}

/**
 * Returns the closest matching subject from availableSubjects if a near-duplicate or prefix match is detected.
 * Prioritizes subjects that start with the typed input, and enforces length-ratio bounds to prevent short words
 * (e.g. "Art") from matching longer inputs (e.g. "artificial").
 */
export function getSubjectSuggestion(input: string, availableSubjects: string[]): string | null {
  const cleanInput = input.trim().toLowerCase()
  if (cleanInput.length < 3) return null

  // If input matches any existing subject exactly (case-insensitive), return null (handled by auto-select)
  if (availableSubjects.some(s => s.toLowerCase() === cleanInput)) return null

  let bestMatch: string | null = null
  let bestScore = Infinity

  for (const subject of availableSubjects) {
    const cleanSub = subject.toLowerCase()

    // 1. STARTS-WITH PREFIX MATCH (Strongest signal: e.g. "artificial" -> "Artificial Intelligence")
    if (cleanSub.startsWith(cleanInput)) {
      const score = cleanSub.length - cleanInput.length
      if (score < bestScore) {
        bestScore = score
        bestMatch = subject
      }
      continue
    }

    // 2. NEAR-MISS TYPO MATCH (e.g. "Artificial Intelligent" -> "Artificial Intelligence", "mathematcs" -> "Mathematics")
    const lengthDiff = Math.abs(cleanInput.length - cleanSub.length)
    // Enforce length-difference threshold to prevent short subjects from matching long typed inputs
    if (lengthDiff > 4) continue

    const distance = getLevenshteinDistance(cleanInput, cleanSub)
    const maxLen = Math.max(cleanInput.length, cleanSub.length)
    const similarity = 1 - distance / maxLen

    if (distance <= 3 && similarity >= 0.70 && distance < bestScore) {
      bestScore = distance
      bestMatch = subject
    }
  }

  return bestMatch
}
