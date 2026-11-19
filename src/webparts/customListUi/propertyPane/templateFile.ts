import * as strings from 'CustomListUiWebPartStrings';
import { MAX_TEMPLATE_LENGTH } from '../templating/TemplateParser';

/** Replaces {0}, {1}, ... in a localized string. */
function format(template: string, ...values: string[]): string {
  return template.replace(/\{(\d+)\}/g, (_m, index: string) => values[Number(index)] ?? '');
}

/**
 * Reads a local .html/.htm file as text after checking its type and size.
 * The file is read in the browser only; it is never uploaded anywhere.
 * @returns The file text. Rejects with an Error whose message is suitable for display.
 */
export function readTemplateFile(file: File): Promise<string> {
  if (!/\.html?$/i.test(file.name)) {
    return Promise.reject(new Error(strings.TemplateWrongFileType));
  }
  // Cheap pre-check on bytes (UTF-8 can use up to 4 bytes per character); the exact character limit is
  // enforced by template validation.
  if (file.size > MAX_TEMPLATE_LENGTH * 4) {
    return Promise.reject(
      new Error(format(strings.TemplateTooLarge, file.size.toLocaleString(), MAX_TEMPLATE_LENGTH.toLocaleString()))
    );
  }

  return new Promise<string>((resolve, reject) => {
    const reader: FileReader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(strings.TemplateReadFailed));
    reader.readAsText(file);
  });
}

/**
 * Saves text to the user's computer as a file. Nothing is stored in SharePoint.
 * @param fileName - Suggested file name.
 * @param content - File content.
 * @param mimeType - Content type, for example "text/html" or "text/plain".
 */
export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob: Blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url: string = URL.createObjectURL(blob);

  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Give the browser a moment to start the download before releasing the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves an .html file to the user's computer. */
export function downloadHtmlFile(fileName: string, content: string): void {
  downloadTextFile(fileName, content, 'text/html');
}
