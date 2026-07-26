export interface CSVHeader {
  label: string
  key: string
}

/**
 * Utility to export an array of data objects to a downloadable CSV file.
 * Handles escaping quotes, UTF-8 BOM encoding, and client-side blob download.
 */
export function exportToCSV(
  filename: string,
  headers: CSVHeader[],
  data: Record<string, any>[]
): boolean {
  if (!data || data.length === 0) {
    return false
  }

  // Generate header row
  const headerRow = headers.map(h => `"${(h.label || '').replace(/"/g, '""')}"`).join(',')

  // Generate data rows
  const dataRows = data.map(row => {
    return headers
      .map(h => {
        let val = row[h.key]
        if (val === null || val === undefined) {
          val = ''
        } else if (typeof val === 'object') {
          val = Array.isArray(val) ? val.join('; ') : JSON.stringify(val)
        }
        const strVal = String(val).replace(/"/g, '""')
        return `"${strVal}"`
      })
      .join(',')
  })

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility
  const csvString = '\uFEFF' + [headerRow, ...dataRows].join('\r\n')
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return true
}
