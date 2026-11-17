import { DEFAULT_TEMPLATE, SAMPLE_FILE_NAME } from '../templating/DefaultTemplate';
import { downloadHtmlFile } from './templateFile';

/**
 * Saves the built-in sample template to the user's computer as an .html file.
 *
 * The file is generated in the browser from the built-in sample only - it never contains the editor's
 * own template, and nothing is stored in SharePoint.
 */
export function downloadSampleHtml(): void {
  downloadHtmlFile(SAMPLE_FILE_NAME, DEFAULT_TEMPLATE);
}
