# Mind Map Editor

A modern, interactive mind mapping application built with React and Konva.js. Users can create, edit, and connect nodes on an infinite canvas to visualize ideas, concepts, and workflows. The app supports light and dark themes, multi-document management (tabs), real-time editing, undo/redo, and secure user authentication with email/password and Google login. All user-created documents are automatically saved to a backend server, with support for unsaved changes tracking and session persistence.

This project is designed for brainstorming, project planning, note-taking, and more. It features a responsive UI that works on desktop, tablet, and mobile devices.

## Features

- **Canvas Editing**:
  - Draw shapes: Rectangle, Ellipse, Diamond, and Text nodes.
  - Connect nodes with lines (edges) for relationships.
  - Infinite canvas with panning, zooming, and grid background.
  - Selection tools: Single/multi-select nodes/edges, drag to resize/move, delete.
  - Property panel for editing node text, size, position, colors, and stroke.

- **Tools & Controls**:
  - Toolbar with select, text, line (connect), shapes, undo/redo, save, export/import JSON, clear canvas.
  - Keyboard shortcuts: Delete/Backspace for removal, Ctrl+Z/Shift+Ctrl+Z for undo/redo.
  - Real-time edge anchoring and updates when moving/resizing nodes.

- **Multi-Document Management**:
  - Create multiple tabs (documents) with unique IDs.
  - Switch between open tabs, reopen closed tabs, rename, and delete.
  - Unsaved changes indicator and auto-save to backend.
  - Session persistence: Temporary documents saved in session/local storage for unauthenticated users, synced upon login.

- **Themes**:
  - Light and dark mode toggle with persistent storage.

- **Authentication & Security**:
  - User registration and login via email/password.
  - Google OAuth integration for seamless sign-in.
  - Account-based document storage: All mind maps are saved to the user's account on the backend.
  - JWT token-based authentication for API requests.
  - Prevent data loss: Warn on navigation if unsaved changes exist.

- **Import/Export**:
  - Export canvas as JSON.
  - Import JSON files to load saved mind maps.

- **Performance & UX**:
  - Debounced updates for efficient state management.
  - Responsive design with mobile-friendly property panel (toggleable on small screens).
  - History stack for undo/redo (up to 50 steps).
  - Grid snapping and visual feedback (e.g., selection boxes, connection highlights).

## Tech Stack

- **Frontend**:
  - React.js (with Hooks)
  - Konva.js & React-Konva for canvas rendering
  - Zustand for state management (with persistence via local/session storage)
  - Tailwind CSS for styling (with dark mode support)
  - Lucide Icons for UI elements
  - Lodash for utilities (e.g., debounce)

- **Other**:
  - UUID for unique IDs.
  - TypeScript for type safety.

## Installation

### Prerequisites
- Node.js (v18+)
- npm or yarn
- A running backend server (e.g., Node.js/Express with MongoDB). If not set up, refer to the backend documentation or implement based on the API calls in the code (e.g., `/api/auth` and `/api/documents`).

### Steps

1. Clone the repository:
   ```
   git clone https://github.com/siefeldeen1/mind-map-editor.git
   cd mind-map-editor
   ```

2. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```
   VITE_API_BASE_URL=http://localhost:5000  # Backend API URL
   VITE_GOOGLE_CLIENT_ID=your-google-client-id  # For Google OAuth
   ```

4. Start the development server:
   ```
   npm run dev
   ```
   or
   ```
   yarn dev
   ```
   The app will run at `http://localhost:8080` (or similar).

5. For the backend:
   - Set up a Node.js server with routes for auth and documents.
   - Use libraries like `express`, `mongoose`, `jsonwebtoken`, and `passport-google-oauth20`.
   - Ensure CORS is enabled for the frontend origin.

## Usage

1. **Sign Up/Login**:
   - Open the app and click "Login" or "Register".
   - Use email/password or Google sign-in.
   - Upon login, any unsaved/unauthorized documents from previous sessions will sync to your account.

2. **Create a Mind Map**:
   - Click the "+" button to add a new tab (document).
   - Use the toolbar to add shapes, text, or connections.
   - Drag nodes to move, resize via handles, edit properties in the side panel.
   - Connect nodes: Select "Line" tool, click source node, then target node.

3. **Manage Documents**:
   - Switch tabs via the header.
   - Rename by double-clicking tab names.
   - Close tabs (moved to "Closed Tabs" for reopening).
   - Delete tabs with confirmation.

4. **Theme Toggle**:
   - Click the sun/moon icon in the toolbar.

5. **Export/Import**:
   - Export: Click the download icon to save as JSON.
   - Import: Click upload and select a JSON file.

6. **Mobile/Tablet**:
   - Property panel appears as a overlay; toggle via the sliders icon.
   - Use pinch-to-zoom and two-finger pan on touch devices.

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/YourFeature`).
3. Commit changes (`git commit -m 'Add YourFeature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a Pull Request.

For bugs or feature requests, open an issue.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by tools like draw.io.
- Built with open-source libraries: React, Konva, Zustand, Tailwind.

