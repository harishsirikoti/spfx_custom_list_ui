import type { SharePointListService } from '../services/SharePointListService';

/** Properties passed from the web part class to the root React component. */
export interface ICustomListUiProps {
  /** Saved value of the removed title property; only used by legacy {wp_title} placeholders. */
  legacyTitle: string;
  /** Saved value of the removed description property; only used by legacy {wp_description} placeholders. */
  legacyDescription: string;
  /** True while the page is being edited; template notes and migration warnings are only shown then. */
  isEditMode: boolean;
  /** GUID of the selected list; empty when none is selected. */
  listId: string;
  /** HTML template that controls the layout; empty when the minimal Fluent UI fallback should be used. */
  htmlTemplate: string;
  /** Service used to read list items as the current user. */
  listService: SharePointListService;
}
