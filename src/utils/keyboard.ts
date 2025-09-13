export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export const matchShortcut = (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    !!event.ctrlKey === !!shortcut.ctrl &&
    !!event.shiftKey === !!shortcut.shift &&
    !!event.altKey === !!shortcut.alt &&
    !!event.metaKey === !!shortcut.meta
  );
};

export const shortcuts = {
  // Tools
  SELECT: { key: 'v' },
  RECTANGLE: { key: 'r' },
  ELLIPSE: { key: 'e' },
  DIAMOND: { key: 'd' },
  TEXT: { key: 't' },
  LINE: { key: 'l' },
  
  // Actions
  DELETE: { key: 'Delete' },
  BACKSPACE: { key: 'Backspace' },
  UNDO: { key: 'z', ctrl: true },
  REDO: { key: 'z', ctrl: true, shift: true },
  SELECT_ALL: { key: 'a', ctrl: true },
  COPY: { key: 'c', ctrl: true },
  PASTE: { key: 'v', ctrl: true },
  CUT: { key: 'x', ctrl: true },
  
  // View
  ZOOM_IN: { key: '=', ctrl: true },
  ZOOM_OUT: { key: '-', ctrl: true },
  ZOOM_FIT: { key: '0', ctrl: true },
  
  // Escape
  ESCAPE: { key: 'Escape' },
} as const;