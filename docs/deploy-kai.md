# Deploy fAIsal + Kai on a Linux VPS (CPU only)

Target: Ubuntu 24.04, 4 GB RAM or more, 10 GB free disk, a sudo user named `deploy`.
Kai (`vllm-sr/Decision-2.0-Kai-0.6B`, 1.5 GB download) runs as a localhost-only Python
service. Laravel calls it at `http://127.0.0.1:8001`. Expect about 1–4 s per decision on CPU.

## 1. Server basics

```bash
ssh deploy@YOUR_SERVER_IP
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip nginx python3 python3-venv python3-pip sqlite3
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Port 8001 is never opened: Kai listens on 127.0.0.1 only.

## 2. Get the code

```bash
sudo mkdir -p /var/www/faisal && sudo chown deploy:deploy /var/www/faisal
git clone YOUR_REPO_URL /var/www/faisal
cd /var/www/faisal
```

## 3. Install and download Kai

```bash
cd /var/www/faisal/inference
python3 -m venv venv
./venv/bin/pip install -r requirements.txt        # CPU-only torch, ~1 GB

# Download the model once, pinned to the reviewed commit (1.5 GB)
export HF_HOME=/var/www/faisal/inference/.hf-cache
./venv/bin/pip install "huggingface_hub[cli]"
./venv/bin/hf download vllm-sr/Decision-2.0-Kai-0.6B --revision cd49ea3813fd8ba0928a9a23ef6c9a0f2f0cd764
```

Smoke-test it by hand (first load takes 20–60 s):

```bash
HF_HUB_OFFLINE=1 ./venv/bin/python server.py
```

In a second SSH session:

```bash
curl -s localhost:8001/health
curl -s -X POST localhost:8001/decide -H 'content-type: application/json' -d '{
  "state": "Crossy Chicken. Pick the best move.\n- UP value 1000\n- LEFT value -30",
  "questions": {"move": {"type": "choice", "instructions": "Reply with the action name",
                         "criteria": {"UP": "value=1000", "LEFT": "value=-30"}}}}'
```

You should see `{"move":{"type":"choice","choice":"UP",...}}`. Stop the server with Ctrl+C.

## 4. Run Kai as a service

```bash
sudo cp /var/www/faisal/inference/kai.service /etc/systemd/system/kai.service
sudo systemctl daemon-reload
sudo systemctl enable --now kai
sudo systemctl status kai          # should say active (running)
journalctl -u kai -f               # live logs (Ctrl+C to leave)
```

It restarts automatically on crash and on reboot.

## 5. Run the Laravel app

PHP 8.5, Composer and Node 22+:

```bash
sudo add-apt-repository -y ppa:ondrej/php && sudo apt update
sudo apt install -y php8.5-fpm php8.5-cli php8.5-sqlite3 php8.5-mbstring php8.5-xml php8.5-curl php8.5-zip php8.5-bcmath
curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

```bash
cd /var/www/faisal
composer install --no-dev --optimize-autoloader
cp .env.example .env && php artisan key:generate
touch database/database.sqlite
npm ci && npm run build
```

Edit `.env`:

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com
KAI_API_URL=http://127.0.0.1:8001
```

```bash
php artisan migrate --force
php artisan optimize
sudo chown -R www-data:www-data storage bootstrap/cache database
sudo chmod -R 775 storage bootstrap/cache database
```

## 6. nginx

`/etc/nginx/sites-available/faisal`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/faisal/public;
    index index.php;

    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.5-fpm.sock;
    }
    location ~ /\.(?!well-known) { deny all; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/faisal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d your-domain.com
```

## 7. Verify

1. `systemctl is-active kai` prints `active`.
2. Register an account at your domain, log in, open **Crossy Chicken** in the sidebar, press Play.
3. Kai picks every move; each one takes a few seconds. If the game shows **KAI FAILED**, run
   `journalctl -u kai -n 50` and `tail -50 /var/www/faisal/storage/logs/laravel.log`.

## Updating

```bash
cd /var/www/faisal && git pull
composer install --no-dev --optimize-autoloader && npm ci && npm run build
php artisan migrate --force && php artisan optimize
sudo systemctl restart kai   # only if inference/ changed
```

## Adding the next AI project

Add `app/Http/Controllers/Projects/<Name>Controller.php`, a page at
`resources/js/pages/projects/<Name>.vue`, routes under the `projects.` group in
`routes/web.php`, and a `services.<name>` config entry. If it needs a model server, add a
second script in `inference/` with its own port and systemd unit, modeled on `kai.service`.
