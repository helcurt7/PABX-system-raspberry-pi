
## 🎖️ The 2026  Master Writeup (PABX Edition)

**Scope**: Incredible PBX 2027 (PABX), NEC ITX-1615, DuckDNS Routing

---

### 🏛️ Phase 1: The PABX Server Setup (Raspberry Pi 4)

This is the "Brain" of your phone system.

* **Operating System**: You MUST use **Raspberry Pi OS Lite (Legacy, 64-bit) Bullseye**. Newer versions (Bookworm) will fail.
* **Installation**: Run as **root** (`sudo -i`) and use the official script:
```bash
wget http://incrediblepbx.com/IncrediblePBX2027-D-RasPi.sh
chmod +x IncrediblePBX2027-D-RasPi.sh
./IncrediblePBX2027-D-RasPi.sh

```


* **Whitelisting**: Incredible PBX has a "White-List Only" firewall. To access the GUI or connect a phone, run:
```bash
/root/add-ip  # To add your current local IP
/root/add-fqdn # To add your DuckDNS domain

```



---

### 🦆 Phase 2: PABX Global Routing (DuckDNS)

This allows your PABX to handle calls from outside your house without needing a static IP.

* **DuckDNS Config**: Map your IP to `yourname.duckdns.org`.
* **PABX NAT Settings**: Go to **Settings → Asterisk SIP Settings** and set the **External Address** to your DuckDNS name.
* **Port Forwarding**: On your router, forward **UDP 5060** (SIP) and **UDP 10000-20000** (RTP Audio) to your Pi’s internal IP.

---

### 📞 Phase 3: Hardware Integration (NEC ITX-1615)

How to connect your physical NEC phone to the PABX.

1. **Create Extension**: In the FreePBX GUI, go to **Applications → Extensions** and create a **PJSIP Extension**.
2. **NEC Phone Config**:
* **Server/Proxy**: Your DuckDNS domain name.
* **User/Auth ID**: Your Extension Number (e.g., 1001).
* **Password**: The "Secret" from the extension page.
* **Codec**: Set to **ulaw** (PCMU) for best compatibility.



---
