# Travel map document

This same-origin iframe isolates the Google Maps SDK's language from the parent
document. Switching interface language replaces only the map document, keeping
unsent chat text, planner answers, and active requests in the parent mounted.

The route reads no applicant/session data and accepts only map display options
from its exact same-origin parent via `viza:travel-map:v1`. Both sides validate
message origin and source. Never pass credentials, full chat history, or
application records through this bridge. The parent owns trip state and handles
point selection/add callbacks. The map frame owns only map presentation.

`trip-route-map-frame.tsx` is the parent bridge under `components/client/travel`;
the existing map surface stays in `trip-route-map.tsx` for a single rendering
implementation. Test locale changes, marker callbacks and draft preservation.
