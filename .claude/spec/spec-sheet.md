1. What This App Does
MuseumLite is a web app that helps you plan and enjoy museum visits. Tell it what you like and how much time you have, and it guides you with smart routes, rich exhibit info, and tools to capture and organize the art you see.

2. Core Features
- Smart Tour: Generate an optimized walking route with turn-by-turn directions and time estimates based on your interests and available time. Uses a custom routing engine built on museum floor plans and caches directions for offline use via a service worker; preferences and tours are saved to Convex under your Clerk account.
- Exhibit Explorer: Search and browse exhibits with high‑res images, curator notes, provenance, and related works; start a tour or save items to your list. Powered by a custom search/index over Convex data and Next.js image delivery; lists and favorites are tied to your Clerk-authenticated profile.
- Art Snapshot: Capture or upload photos to auto‑tag artworks, add notes or voice memos, then save or share your collection. Runs a custom, on-device image recognition model in the browser (WebAssembly/WebGPU) with no external provider; media and metadata persist in Convex for your Clerk user.

3. Tech Stack
- Framework: Next.js 15 (App Router, Server Actions, PWA support)
- Database: Convex (real-time storage for exhibits, tours, and user collections)
- Auth: Clerk (user accounts, sessions, profiles)
- Feature-Specific (custom): Indoor routing engine and time estimator; exhibit search/index; on-device image recognition (WebAssembly/WebGPU); PWA service worker for offline directions/assets; camera via MediaDevices and audio notes via MediaRecorder

4. UI Design Style
Modern, clean, intuitive UI without being flashy.