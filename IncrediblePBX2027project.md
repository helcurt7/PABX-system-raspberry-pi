This is the final, unified **2026 Master Writeup** for your **PABX Infrastructure**. It combines your Raspberry Pi installation, DuckDNS global routing, Stealth Port defense, and NEC/WebRTC integration into a single professional document.

---

# 🎖️ 2026 : PABX Master Manual

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



Part 1: The "Redirect" Explanation
You asked: "wss://avoip.duckdns.org:8089/ws this will redirect to where?"
It acts like a tunnel, not a web page redirect:
 * You (Outside): Your browser yells "Connect!" to avoip.duckdns.org on port 8089.
 * The Public Internet: Finds your Router's Public IP.
 * The Router (Next Week): Sees a request on 8089. It looks at its "Map" (Port Forwarding) and says, "Ah, 8089 belongs to the internal device 192.168.50.32."
 * The Destination: The traffic hits your Raspberry Pi on 192.168.50.32:8089, where Asterisk picks it up.
Part 2: The Master Writeup (Copy & Paste)
Goal: Secure WebSockets (WSS) and Mobile SIP (UDP) on Incredible PBX 2027.
Prerequisite: Router installed with Port Forwarding active.
Phase A: The Router Setup (Do this first next week)
Log into the router (Gateway) and forward these ports to 192.168.50.32:
 * TCP 80 (HTTP - Required for SSL Certificate generation)
 * TCP 8089 (WSS - The Secure WebSocket Tunnel)
 * UDP 5060 (SIP - For Zoiper Mobile)
 * UDP 10000-20000 (RTP - Audio Path)
Phase B: The CLI "Success" Commands (Run these on the Pi)
These are the commands you successfully ran today. Run them again if you ever reinstall or to confirm everything is locked in.
1. Automate DuckDNS (The Heartbeat)
Ensures your domain always points to your router.
# Create the script
nano /usr/local/bin/duckdns.sh

# PASTE THIS INSIDE NANO (Replace YOUR_TOKEN):
# echo url="https://www.duckdns.org/update?domains=avoip&token=YOUR_TOKEN&ip=" | curl -k -o /var/log/duck.log -K -
# (Save with Ctrl+O, Enter, Ctrl+X)

# Make it executable and schedule it
chmod +x /usr/local/bin/duckdns.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/duckdns.sh >/dev/null 2>&1") | crontab -

2. Whitelist & Firewall (The Bouncer)
Tells the firewall to trust your DuckDNS address and open the WebSocket port.
# Whitelist your domain (Choose options 1,2,4,8 when asked)
/root/add-fqdn ComtechAdmin avoip.duckdns.org

# Manually force open the WebSocket port (The "Success Command")
iptables -I INPUT -p tcp --dport 8089 -j ACCEPT
iptables-save > /etc/iptables/rules.v4

3. Generate SSL Certificate (The Green Lock)
Crucial: This only works AFTER the Router Port 80 forwarding is done.
/root/pks-certs
# Follow prompts. Enter domain: avoip.duckdns.org

Phase C: The GUI Configuration
Log into https://192.168.50.32
 * Activate the Certificate:
   * Go to Settings → Certificate Manager.
   * Find the "avoip.duckdns.org" cert. Click the Arrow/Check icon to set as "Default".
 * Configure SIP Transport:
   * Go to Settings → Asterisk SIP Settings → PJSIP Tab.
   * Certificate Manager: Select "avoip.duckdns.org".
   * SSL Method: Default.
   * Verify Client: No.
   * External IP: Click "Detect Network Settings" (It should find your DuckDNS IP).
 * Enable User WebRTC:
   * Applications → Extensions → Edit User (1001).
   * Advanced Tab → Enable WebRTC: Yes.
Phase D: The Connection String (For your App)
When building your Web Phone or configuring a client:
 * WebSocket URL: wss://avoip.duckdns.org:8089/ws
 * SIP Domain: avoip.duckdns.org
 * Port: 8089
