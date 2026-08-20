/** Prevent duplicate native recovery dialogs while allowing later independent failures. */
export function createRecoveryGate() {
  let open = false;
  return {
    tryOpen() {
      if (open) return false;
      open = true;
      return true;
    },
    release() {
      open = false;
    },
    isOpen() {
      return open;
    },
  };
}
