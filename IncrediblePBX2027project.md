This is the final, unified **2026 Master Writeup** for your **PABX Infrastructure**. It combines your Raspberry Pi installation, DuckDNS global routing, Stealth Port defense, and NEC/WebRTC integration into a single professional document.

---

# 🎖️ 2026 Military Order: PABX Master Manual

**Target:** Incredible PBX 2027 (Raspberry Pi 4)

**Objective:** Secure, Globally Accessible VoIP with Web3 Integration

**Status:** **OPERATIONAL**

---

## 🏛️ Phase 1: The Core Installation (Raspberry Pi 4)

*Crucial:* Do not use the default "Bookworm" OS. It will fail.

### 1. Flash the OS

* **Image:** Raspberry Pi OS Lite (Legacy, 64-bit) **Bullseye**.
* **Imager Settings:**
* **Hostname:** `incrediblepbx`
* **User:** `pi` (or your choice)
* **SSH:** Enabled (Password auth)



### 2. Run the Installer

SSH into the Pi as `root` (use `sudo -i`) and run:

```bash
wget http://incrediblepbx.com/IncrediblePBX2027-D-RasPi.sh
chmod +x IncrediblePBX2027-D-RasPi.sh
./IncrediblePBX2027-D-RasPi.sh

```

* **Note:** If the screen pauses on a "Node.js Deprecation" warning or "Downloading Modules," **DO NOT CANCEL**. Wait it out (can take 20+ mins).

### 3. Basic Access

* **Web GUI:** `http://<IP-ADDRESS>` (User: `admin`)
* **Passwords:** Run `/root/show-passwords` in the terminal to retrieve them.
* **Whitelist PC:** The firewall blocks everything by default. Run `/root/add-ip` to allow your current PC.

---

## 🦆 Phase 2: Global Routing (DuckDNS)

*Objective:* Make your home PABX accessible from anywhere in the world.

### 1. DNS Mapping

* Ensure your **DuckDNS** domain (e.g., `helcurt.duckdns.org`) points to your home public IP.
* **Whitelist Domain:** Tell the Pi to trust this name:
```bash
/root/add-fqdn
# Enter 'helcurt.duckdns.org' when prompted

```



### 2. NAT Configuration (The "One-Way Audio" Fix)

In FreePBX GUI: **Settings → Asterisk SIP Settings → General SIP Settings**.

* **External Address:** `helcurt.duckdns.org`
* **Local Networks:** `192.168.50.0 / 255.255.255.0` (Adjust to your subnet)
* **Submit & Apply.**

---

## 🛡️ Phase 3: Stealth Defense (Port 5066)

*Objective:* Move SIP off the standard port 5060 to evade 90% of bot attacks.

### 1. Change PJSIP Port

Run as root:

```bash
fwconsole kvstore set sip port_pjsip 5066
fwconsole reload
netstat -ulpn | grep asterisk
# Verify it now says 0.0.0.0:5066

```

### 2. Fail2Ban "Pro" Config

Edit the jail file: `nano /etc/fail2ban/jail.local`. Add this to the bottom:

```ini
[asterisk]
enabled = true
filter = asterisk
port = 5066,5060,5061
logpath = /var/log/asterisk/full
maxretry = 3
bantime = 86400

```

* **Restart Defense:** `systemctl restart fail2ban`

---

## 🌐 Phase 4: WebRTC & WebSocket (Port 8089)

*Objective:* Enable browser-based calls and secure Zoiper Web connections.

### 1. Certificate & Server

* **Cert:** Admin → Certificate Management → Generate Self-Signed (Make Default).
* **Mini-HTTP:** Settings → Advanced Settings. Enable **Mini-HTTP Server**, set **HTTPS Port** to `8089`.

### 2. The "Browser Trick" (Handshake)

* **Action:** Open Chrome and go to `https://helcurt.duckdns.org:8089/ws`
* **Result:** Click **Advanced → Proceed**. You *must* do this once to trust the cert.

### 3. Extension GUI "Tick" List

For your WebRTC extension (e.g., 999), ensure these **Advanced** settings are ticked:

* [x] **Enable AVPF**: Yes
* [x] **Enable ICE Support**: Yes
* [x] **Media Encryption**: DTLS-SRTP
* [x] **Enable DTLS**: Yes
* [x] **DTLS Verify**: Fingerprint
* [x] **DTLS Setup**: Act/Pass

---

## 📞 Phase 5: Client Setup (Zoiper & NEC)

### 📱 Option A: Zoiper Mobile (External)

* **Domain:** `helcurt.duckdns.org:5066` (Note the custom port!)
* **Username:** Extension Number (e.g., 1001)
* **Password:** Extension Secret
* **Transport:** UDP

### ☎️ Option B: NEC ITX-1615 (Physical Phone)

* **SIP Server:** `helcurt.duckdns.org`
* **Server Port:** `5066`
* **User ID:** Extension Number
* **Password:** Extension Secret
* **Audio Codec:** Enable **G.711 u-law** (PCMU).

---

## 📡 Phase 6: Router Port Forwarding

*Final Step:* Forward these ports on your home router to your Pi's internal IP:

| Port | Protocol | Purpose |
| --- | --- | --- |
| **5066** | **UDP** | SIP Signaling (The Stealth Port) |
| **8089** | **TCP** | Secure WebSocket (WebRTC/React) |
| **10000-20000** | **UDP** | RTP Audio (Critical for Voice) |

---

### 🔎 Troubleshooting Cheat Sheet

* **Register Timeout:** Check `/var/log/fail2ban.log`. You might have banned yourself. Unban with `fail2ban-client set asterisk unbanip <your-ip>`.
* **No Audio:** 99% of the time, this is the **UDP 10000-20000** forwarding missing on the router.
* **WebSocket Fail:** Did you do the "Browser Trick" (Phase 4, Step 2)?
