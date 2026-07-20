// Signaling server URL. Override at build time via VITE_SIGNALING_URL,
// e.g. VITE_SIGNALING_URL="https://chat.example.com" npm run build
// If not set, the client connects to the same origin the app is served from
// (works well behind an Nginx reverse-proxy that forwards /socket.io/).
export const SIGNALING_URL: string =
  (import.meta.env.VITE_SIGNALING_URL as string | undefined) ?? window.location.origin;

// Public STUN servers. For production behind symmetric NAT you should also
// run your own TURN server (e.g. coturn) and add it here.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  // Example TURN entry (uncomment and fill in):
  // { urls: "turn:turn.example.com:3478", username: "user", credential: "pass" },
];
