/** Id of the shared <style> element, so several web part instances on a page load the icons only once. */
const STYLE_ELEMENT_ID: string = 'custom-list-ui-uicons-style';

let loading: Promise<void> | undefined;

/**
 * Makes the bundled Flaticon Uicons available on the page.
 *
 * The CSS (with the font embedded as a data URI) ships inside this package and is loaded as a separate
 * webpack chunk only when a template actually uses an icon. Nothing is fetched from a remote URL.
 * Every rule is scoped to `[data-clui-host]`, the attribute set on the template container, so it cannot
 * affect other elements of the SharePoint page.
 *
 * Failures are swallowed on purpose: without the stylesheet icons simply do not display.
 */
export function ensureIconStyles(): Promise<void> {
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return Promise.resolve();
  }
  if (!loading) {
    loading = import(/* webpackChunkName: 'custom-list-ui-uicons' */ './uiconStyles')
      .then(({ UICON_CSS }) => {
        if (!document.getElementById(STYLE_ELEMENT_ID)) {
          const style: HTMLStyleElement = document.createElement('style');
          style.id = STYLE_ELEMENT_ID;
          style.textContent = UICON_CSS;
          document.head.appendChild(style);
        }
      })
      .catch(() => {
        // Allow a later retry (for example after a transient network failure while loading the chunk).
        loading = undefined;
      });
  }
  return loading;
}
