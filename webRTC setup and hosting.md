This is the ultimate master document. You’ve built this system from the ground up, bypassed ISP restrictions, and successfully encrypted the connection for browser-based calling. 

Just a quick reminder for your notes: the certificate you generated using `acme.sh` is actually a **real, globally trusted Let's Encrypt certificate**, not a self-signed one. That is exactly why the browser finally accepted your connection!

Here is the complete, start-to-finish documentation. 

***

# Master Setup Guide: Bypassing ISP Blocks for DDNS, Let's Encrypt SSL, and WebRTC on Incredible PBX

## Overview
Standard residential and commercial ISPs frequently block Port 80 (HTTP), preventing standard SSL generation and external access. To host a secure PABX system on a Raspberry Pi and enable WebRTC (browser-based calling), we bypass the ISP block using a DNS challenge via DuckDNS. We then securely bind this certificate to Apache and Asterisk, and manually punch the required TCP/UDP holes through the hardware router and the Incredible PBX internal firewall.

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
5. **Import to FreePBX:** Go to FreePBX **Admin -> Certificate Management** and upload or link the generated certificate files so Asterisk can use them. Mark it as the Default certificate.

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

### Phase 6: Create the WebRTC Extension
1. Navigate to **Applications** -> **Extensions** and add/edit a **PJSIP Extension**.
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
5. Click **Submit** and **Apply Config**.

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
* Save, exit, and restart the firewall:
  ```bash
  /usr/local/sbin/iptables-restart
  ```

**2. Ruijie Hardware Router (Port Forwarding)**
* Forward external traffic to the local Pi IP (`192.168.50.32`):
  * **Rule 1:** Port `443` (TCP)
  * **Rule 2:** Port `80` (TCP)
  * **Rule 3:** Port `8089` (TCP)
  * **Rule 4:** Ports `10000-20000` (UDP)

### Phase 8: The "Deep" Asterisk Restart & Verification
Applying configurations in the FreePBX GUI is not enough to bind new transport ports.
1. In the SSH terminal, run the core engine restart:
  ```bash
  fwconsole restart
  ```
2. **Browser Trust:** Open a new browser tab and visit **`https://avoip.duckdns.org:8089/ws`**. Ensure it displays a white screen reading **"Upgrade Required"** to confirm the port is open and trusted.
3. **Connection Test:** Open a WebRTC client (e.g., [tryit.jssip.net](https://tryit.jssip.net/)), input your SIP URI (`sip:EXT@avoip.duckdns.org`), password, and WebSocket URI (`wss://avoip.duckdns.org:8089/ws`). Connect to verify the green registration status.

***

Now that you have the complete blueprint locked down, would you like me to walk you through configuring an automated script so that 90-day Let's Encrypt certificate renews itself without you having to touch the terminal?


# auto renew SSL Lets ENcrypt de

The secret to this is that the script you used earlier (`acme.sh`) is actually incredibly smart. When you ran that installation command, it quietly created an invisible `cron` job (a scheduled task) in your Raspberry Pi's background. 

It is already scheduled to wake up every single night at midnight, check if your certificate is 60 days old, and if it is, it will automatically talk to DuckDNS and download the new one. 

However, there is one missing link: **When it downloads the new certificate, Asterisk (the PBX) and Apache (the Website) won't realize it changed until they are restarted.**

Here is the one-time command you need to run to tell `acme.sh` exactly where to copy the files and how to restart your services when the 60-day renewal hits.

### Step 1: Prove the Cron Job Exists
First, let's look at the invisible schedule `acme.sh` created. In your Pi's terminal (as `root`), run this:
```bash
crontab -l
```
You will see a line that looks something like this:
`15 0 * * * "/root/.acme.sh"/acme.sh --cron --home "/root/.acme.sh" > /dev/null`
*(This means: Run the renewal check every day at 12:15 AM).*

### Step 2: The Ultimate `--install-cert` Command
We are going to use the official `acme.sh` installation command. This command tells the robot: *"When you get a new certificate, overwrite the FreePBX files, and then restart both Apache and the phone system."*

Because you named your certificate `duckdns` inside the FreePBX Certificate Manager, FreePBX created files named `duckdns.key` and `duckdns.crt` inside its secure keys folder. We will target those directly!

Run this entire block of code as one command in your terminal (make sure to use your actual domain):

```bash
/root/.acme.sh/acme.sh --install-cert -d avoip.duckdns.org \
--cert-file /etc/asterisk/keys/duckdns.crt \
--key-file /etc/asterisk/keys/duckdns.key \
--fullchain-file /etc/asterisk/keys/duckdns.pem \
--reloadcmd "systemctl restart apache2 && fwconsole restart"
```

### What did this just do?
1. **File Overwrite:** It automatically copied the fresh, newly generated certificates and overwrote the ones FreePBX uses. (Apache is already pointing to the `acme.sh` folder, so it reads the new ones automatically).
2. **The `--reloadcmd`:** This is the magic. `acme.sh` saves this command in its memory. From now on, whenever the nightly cron job successfully gets a new certificate from Let's Encrypt, it will instantly run `systemctl restart apache2` and `fwconsole restart`.

### Step 3: Test the Automation (Force a Renewal)
You never want to wait 60 days to find out if your automation script has a typo. You can force `acme.sh` to run a fake "dry run" renewal right now to ensure it successfully restarts everything.

Run this:
```bash
/root/.acme.sh/acme.sh --cron --force
```

Watch the terminal. You will see it reach out to DuckDNS, verify the domain, download the cert, copy it to `/etc/asterisk/keys/`, and then finally, you should see Asterisk and Apache restart.

If that terminal output succeeds and your services reboot, you are officially completely hands-off. You can host your web apps and your PBX, and the Let's Encrypt robots will keep you secure forever.

***

Now that the entire infrastructure is fully automated, secure, and handling WebRTC, do you want to test that codec fix we talked about earlier so your browser (101) can successfully call your physical desk phone (1002)?
