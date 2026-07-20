# Ranvo — Deployment (Debian 12 + Nginx + pm2)

Two pieces:

1. **Frontend** — static Vite build in `dist/`, served by Nginx from `/var/www/html`.
2. **Signaling server** — Node.js + Socket.IO in `server/`, managed by pm2, reverse-proxied by Nginx at `/socket.io/`.

Media (audio/video) flows **peer-to-peer** over WebRTC. The signaling server only exchanges SDP + ICE candidates and text-chat messages.

---

## 0. Prerequisites (Debian 12)

```bash
sudo apt update
sudo apt install -y nginx curl ca-certificates
# Node.js 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

You will also need HTTPS. Browsers only allow `getUserMedia` on `https://` (or `http://localhost`). Use Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 1. Signaling server

```bash
# On the server
sudo mkdir -p /opt/ranvo
sudo chown "$USER":"$USER" /opt/ranvo
# Copy the server/ folder from this repo to /opt/ranvo/server
scp -r server/ user@your-server:/opt/ranvo/

cd /opt/ranvo/server
npm install --omit=dev
```

Edit `ecosystem.config.cjs` and set `CORS_ORIGIN` to the exact origin of your site (e.g. `https://chat.example.com`). Then:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd     # run the command it prints, once
```

Verify it's up:

```bash
curl http://127.0.0.1:3001/healthz
# {"ok":true,"uptime":...,"online":0}
```

---

## 2. Frontend build

On your dev machine (or the server):

```bash
# Point the client at your public signaling origin.
# Must be the origin the browser reaches — normally your own domain,
# since Nginx will reverse-proxy /socket.io/ to Node.
echo 'VITE_SIGNALING_URL=https://chat.example.com' > .env.production

npm install
npm run build
```

Copy `dist/` onto the server:

```bash
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
```

> If you leave `VITE_SIGNALING_URL` unset, the client connects to `window.location.origin`, which also works because Nginx proxies `/socket.io/` on the same domain.

---

## 3. Nginx

Create `/etc/nginx/sites-available/ranvo`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name chat.example.com;

    # Certbot will add TLS + a redirect to :443 automatically.

    root /var/www/html;
    index index.html;

    # SPA fallback — client-side routing.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-lived immutable Vite assets.
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    # Socket.IO signaling — WebSocket upgrade + long-polling fallback.
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Enable + reload:

```bash
sudo ln -sf /etc/nginx/sites-available/ranvo /etc/nginx/sites-enabled/ranvo
sudo nginx -t
sudo systemctl reload nginx
```

Get TLS:

```bash
sudo certbot --nginx -d chat.example.com
```

Open the site at `https://chat.example.com` and click **Start Video Chat**. Open a second browser (or an incognito tab on another device) — you'll be matched.

---

## 4. STUN / TURN

The client is preconfigured with public Google + Cloudflare STUN servers (see `src/lib/signaling.ts`). STUN is enough for most home connections.

If you sit behind symmetric NAT / restrictive corporate networks, calls will fail to connect. Run **coturn** on the same box:

```bash
sudo apt install -y coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
```

Minimal `/etc/turnserver.conf`:

```conf
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
realm=chat.example.com
server-name=chat.example.com
fingerprint
lt-cred-mech
user=ranvo:CHANGE_ME_STRONG_PASSWORD
no-multicast-peers
no-cli
```

Open ports 3478/udp+tcp (and 5349/tcp for TLS) in your firewall, then:

```bash
sudo systemctl enable --now coturn
```

Add it to `src/lib/signaling.ts`:

```ts
{ urls: "turn:chat.example.com:3478", username: "ranvo", credential: "CHANGE_ME_STRONG_PASSWORD" },
```

Rebuild and redeploy `dist/`.

---

## 5. Updating

Frontend:

```bash
git pull
npm install
npm run build
sudo rsync -a --delete dist/ /var/www/html/
```

Signaling server:

```bash
cd /opt/ranvo/server
git pull            # or scp the new files
npm install --omit=dev
pm2 reload ranvo-signaling
```

---

## 6. Troubleshooting

- **`getUserMedia` throws `NotAllowedError`** → HTTPS is missing, or the user denied permissions.
- **Socket connects but nobody matches** → open two different browsers (or one normal + one incognito). Same tab can't match itself.
- **Matched, but no remote video** → almost always NAT. Add a TURN server (section 4).
- **`online` counter stays at 0** → Nginx isn't proxying `/socket.io/`. Check `curl -i https://chat.example.com/socket.io/?EIO=4&transport=polling` — you should get a Socket.IO handshake JSON, not `index.html`.
- **CORS errors in the browser console** → `CORS_ORIGIN` in `ecosystem.config.cjs` doesn't match the browser's origin. Update and `pm2 reload ranvo-signaling`.
