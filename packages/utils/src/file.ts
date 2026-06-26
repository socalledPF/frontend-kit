export interface DownloadBlobOptions {
  type?: string
  revokeDelay?: number
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '')
}

function decodeFilename(value: string): string {
  const normalized = stripQuotes(value.trim()).replace(/^UTF-8''/i, '')

  try {
    return decodeURIComponent(normalized)
  } catch {
    return normalized
  }
}

export function getFileExt(filename: string): string {
  const cleanName = filename.split(/[?#]/)[0] ?? ''
  const baseName = cleanName.slice(cleanName.lastIndexOf('/') + 1)
  const dotIndex = baseName.lastIndexOf('.')

  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return ''
  }

  return baseName.slice(dotIndex + 1).toLowerCase()
}

export function getFileNameFromHeader(header: string | null | undefined): string {
  if (!header) {
    return ''
  }

  const parts = header.split(';').map((part) => part.trim())
  const filenameStar = parts.find((part) => part.toLowerCase().startsWith('filename*='))

  if (filenameStar) {
    return decodeFilename(filenameStar.slice(filenameStar.indexOf('=') + 1))
  }

  const filename = parts.find((part) => part.toLowerCase().startsWith('filename='))
  return filename ? decodeFilename(filename.slice(filename.indexOf('=') + 1)) : ''
}

export function downloadBlob(
  blob: Blob | ArrayBuffer | string,
  filename: string,
  options: DownloadBlobOptions = {}
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('downloadBlob can only be used in a browser environment.')
  }

  const { type = 'application/octet-stream', revokeDelay = 0 } = options
  const file = blob instanceof Blob ? blob : new Blob([blob], { type })
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, revokeDelay)
}
