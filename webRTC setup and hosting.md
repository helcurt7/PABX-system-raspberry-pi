***

# Master Setup Guide: Bypassing ISP Blocks for DDNS, Let's Encrypt SSL, and WebRTC on Incredible PBX

## Overview
Standard residential and commercial ISPs frequently block Port 80 (HTTP), preventing standard SSL generation and external access. To host a secure PABX system on a Raspberry Pi and enable WebRTC (browser-based calling), we bypass the ISP block using a DNS challenge via DuckDNS. We then securely bind this certificate to Apache and Asterisk, configure WebRTC extensions, force audio codecs for physical phone compatibility, automate the 90-day renewal, and manually punch the required TCP/UDP holes through the hardware router and the Incredible PBX internal firewall.

---

### Phase 1: Dynamic DNS (DDNS) & Network Routing
1. **Verify True Public IP:** Check the WAN IP inside the Ruijie router dashboard and compare it against an external tool like `portchecker.co`. Ensure you are not caught in a Double NAT setup where the router's IP differs from the true public IP.
2. **Update DuckDNS:** Log into DuckDNS and ensure the subdomain (e.g., `avoip.duckdns.org`) strictly matches the true public IP.

### Phase 2: Generating the SSL Certificate (DNS Challenge)
Because Port 80 is blocked, we use the `acme.sh` script to securely prove domain ownership via the DuckDNS API.
1. **Access the Server:** SSH into the Raspberry Pi as the `root` user (`sudo su -`).
2. **Install acme.sh:**
   ```bash
   curl https://get.acme.sh | sh -s email=your_email@gmail.com
   ```
3. **Export the API Token:** Provide the system with your DuckDNS token:
   ```bash
   export DuckDNS_Token="your-duckdns-token-here"
   ```
4. **Issue the Certificate:** Run the DNS challenge to generate the keys:
   ```bash
   /root/.acme.sh/acme.sh --issue --dns dns_duckdns -d avoip.duckdns.org
   ```
   *(Note: Success yields `fullchain.cer` and `avoip.duckdns.org.key` in `/root/.acme.sh/avoip.duckdns.org_ecc/`)*

### Phase 3: Configuring Apache & FreePBX for the SSL Certificate
1. **Enable Apache SSL Modules:**
   ```bash
   a2enmod ssl
   a2ensite default-ssl
   ```
2. **Edit the Virtual Host Configuration:**
   ```bash
   nano /etc/apache2/sites-enabled/default-ssl.conf
   ```
3. **Link the Certificates:** Scroll down and update the file paths to point directly to the generated ACME files:
   ```apache
   SSLCertificateFile /root/.acme.sh/avoip.duckdns.org_ecc/fullchain.cer
   SSLCertificateKeyFile /root/.acme.sh/avoip.duckdns.org_ecc/avoip.duckdns.org.key
   ```
4. **Restart Apache:**
   ```bash
   systemctl restart apache2
   ```
5. **Import the Certificate into FreePBX (Manual Copy/Paste):**
   For the very first setup, you must manually copy the keys into the PBX dashboard.
   * **View the Private Key:**
     ```bash
     cat /root/.acme.sh/avoip.duckdns.org_ecc/avoip.duckdns.org.key
     ```
     Highlight and copy the *entire* block of text, including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`.
   * **View the Fullchain Certificate:**
     ```bash
     cat /root/.acme.sh/avoip.duckdns.org_ecc/fullchain.cer
     ```
     Highlight and copy this entire block as well (it contains two separate "BEGIN" blocks).
   * **Paste into FreePBX:** Go to FreePBX **Admin -> Certificate Management**. Click **New Certificate -> Upload Certificate**. Name it `duckdns`. Paste the Key and Certificate into their respective boxes. Leave Passphrase blank. Click **Generate / Import**.
   * **Set as Default:** Click the checkmark icon next to the new `duckdns` certificate to make it the System Default.

### Phase 4: Enable the Secure Mini-HTTP Server (WebRTC Prep)
Asterisk needs its internal web server turned on to listen for WebSocket connections.
1. Navigate to **Settings** -> **Advanced Settings**.
2. Set **Enable mini-HTTP Server** to `Yes`.
3. Set **Enable TLS for mini-HTTP Server** to `Yes`.
4. Set **HTTPS Bind Address** to `0.0.0.0` *(Crucial: ensures it listens to external traffic).*

### Phase 5: Configure the SIP Engine (PJSIP Transports)
The SIP engine must be explicitly authorized to use WSS and linked to the SSL certificate.
1. Navigate to **Settings** -> **Asterisk SIP Settings**.
2. On the **General SIP Settings** tab, scroll down to **Security Settings**.
3. Change **Default TLS Certificate** from `Default/None` to your imported DuckDNS certificate.
4. Switch to the **SIP Settings (or PJSIP Settings)** tab.
5. Scroll down to the **Transports** section. Find `wss - 0.0.0.0 - All` and toggle it to **Yes**.
6. Click **Submit** and **Apply Config**.

### Phase 6: Create the WebRTC Extension & Fix Codecs
Standard SIP extensions will reject browser calls. The extension must be configured for strict browser encryption and standard audio codecs so it can talk to physical desk phones.
1. Navigate to **Applications** -> **Extensions** and add/edit a **PJSIP Extension** (e.g., `101`).
2. Go to the **Advanced** tab and toggle **Enable WebRTC** to `Yes`.
3. **DTLS Settings:**
   * Enable DTLS: `Yes`
   * Auto Generate Certificate: `No`
   * Use Certificate: Select your imported DuckDNS certificate.
   * DTLS Verify: `Fingerprint`
   * DTLS Setup: `Act/Pass`
4. **Media Settings:**
   * Enable AVPF: `Yes`
   * Force AVPF: `Yes`
   * ICE Support: `Yes`
   * Media Encryption: `DTLS-SRTP`
5. **Codec Compatibility Fix (Crucial for calling standard physical phones):**
   * Disallowed Codecs: `all`
   * Allowed Codecs: `ulaw&alaw`
   *(Note: Ensure your physical phone extension, like 1002, also has these exact codec settings so they speak the same language).*
6. Click **Submit** and **Apply Config**.

### Phase 7: Persistent Firewall & Network Routing
Traffic must be permitted through the physical router and the PBX's internal Travelin' Man firewall.

**1. Incredible PBX Firewall (`iptables`)**
* Open the custom firewall script:
  ```bash
  nano /usr/local/sbin/iptables-custom
  ```
* Append the following rules to the bottom to permanently open HTTPS, HTTP (for local redirects), WSS, and RTP audio streams:
  ```bash
  iptables -I INPUT -p tcp --dport 443 -j ACCEPT
  iptables -I INPUT -p tcp --dport 80 -j ACCEPT
  iptables -I INPUT -p tcp --dport 8089 -j ACCEPT
  iptables -I INPUT -p udp --dport 10000:20000 -j ACCEPT
  ```
* Save (`Ctrl+O`, `Enter`), exit (`Ctrl+X`), and restart the firewall:
  ```bash
  /usr/local/sbin/iptables-restart
  ```

**2. Ruijie Hardware Router (Port Forwarding)**
* Forward external traffic to the local Pi IP (`192.168.50.32`):
  * **Rule 1:** Port `443` (TCP)
  * **Rule 2:** Port `80` (TCP)
  * **Rule 3:** Port `8089` (TCP)
  * **Rule 4:** Ports `10000-20000` (UDP)

### Phase 8: Automating the 90-Day Let's Encrypt SSL Renewal
Let's Encrypt certificates expire strictly every 90 days. We must configure the invisible `acme.sh` cron job to not only download the new certificate but also overwrite the FreePBX keys and restart the core services automatically.

1. In the SSH terminal, run this exact installation command to bind the renewal to FreePBX and Apache:
   ```bash
   /root/.acme.sh/acme.sh --install-cert -d avoip.duckdns.org \
   --cert-file /etc/asterisk/keys/duckdns.crt \
   --key-file /etc/asterisk/keys/duckdns.key \
   --fullchain-file /etc/asterisk/keys/duckdns.pem \
   --reloadcmd "systemctl restart apache2 && fwconsole restart"
   ```
2. **Force a Dry Run to Test:**
   ```bash
   /root/.acme.sh/acme.sh --cron --force
   ```
   *(Watch the terminal to confirm it downloads the keys, copies them to the `/etc/asterisk/keys/` folder, and successfully reboots Apache and Asterisk).*

### Phase 9: The "Deep" Asterisk Restart & Verification
Applying configurations in the FreePBX GUI is not enough to bind new transport ports.
1. In the SSH terminal, run the core engine restart:
  ```bash
  fwconsole restart
  ```
2. **Browser Trust:** Open a new browser tab and visit **`https://avoip.duckdns.org:8089/ws`**. Ensure it displays a white screen reading **"Upgrade Required"** to confirm the port is open and trusted.
3. **Connection Test:** Open a WebRTC client (e.g., [tryit.jssip.net](https://tryit.jssip.net/)), input your SIP URI (`sip:101@avoip.duckdns.org`), password, and WebSocket URI (`wss://avoip.duckdns.org:8089/ws`). Connect to verify the green registration status, then try calling your physical desk phone!
