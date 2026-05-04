/** Shared confirm-modal payload from App.openConfirm(...) */
export type OpenConfirmPayload = {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  /** Detail-only: Enter/Esc closes without running onConfirm. */
  readOnly?: boolean;
};
