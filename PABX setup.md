This is **Part 1** of your project documentation. It covers everything from a fresh Raspberry Pi to the moment you can make your first phone call (before adding the custom music).

You can add this to your GitHub as **"Phase 1: Core System Setup."**

---

# 📞 Building a VoIP Server with Asterisk & Raspberry Pi

**Project Overview:** Setting up a private PBX (Private Branch Exchange) using a Raspberry Pi to manage calls between NEC legacy hardware phones.

## 📋 Prerequisites

* **Server:** Raspberry Pi 4 (or newer) running Ubuntu Server / Raspberry Pi OS.
* **Network:** Ethernet switch/router connecting the Pi and Phones.
* **Clients:** 2x NEC ITX-1615 IP Phones.

---

## ⚙️ Step 1: System Preparation

*Run these commands on the Raspberry Pi terminal.*

### 1. Update & Install Dependencies

Before installing Asterisk, we need the "compilation tools" to build the software from source.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git wget libnewt-dev libssl-dev libncurses5-dev uuid-dev libjansson-dev libxml2-dev sqlite3 libsqlite3-dev

```

### 2. Set a Static IP (Crucial for VoIP)

VoIP phones need to know exactly where the server is. If the IP changes, the phones disconnect.

* **Edit Netplan:** `sudo nano /etc/netplan/50-cloud-init.yaml`
* **Example Config:**
```yaml
network:
  ethernets:
    eth0:
      dhcp4: no
      addresses: [192.168.50.32/24]  # Your Pi's Static IP
      routes:
        - to: 0.0.0.0/0
          via: 192.168.50.1          # Your Gateway/Router
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]

```


* **Apply:** `sudo netplan apply`

---

## 🛠️ Step 2: Install Asterisk (Source Method)

We install from source to get the latest version (20.x) and PJSIP support.

```bash
# 1. Download Asterisk Source
cd /usr/src/
sudo wget http://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz
sudo tar zxf asterisk-20-current.tar.gz
cd asterisk-20*

# 2. Configure & Check Dependencies
sudo contrib/scripts/install_prereq install
sudo ./configure --with-jansson --with-libxml2 --with-sqlite3

# 3. Compile and Install (This takes 10-20 mins on a Pi!)
sudo make menuselect  # (Press Save & Exit)
sudo make -j4         # Uses all 4 CPU cores
sudo make install
sudo make samples     # Installs example config files
sudo make config      # Sets Asterisk to start at boot
sudo ldconfig

```

---

## 🔌 Step 3: Configure Core PABX Files

We strip down the complex default files to create a clean, working PABX.

### 1. Backup Default Configs

```bash
sudo mv /etc/asterisk/pjsip.conf /etc/asterisk/pjsip.conf.bak
sudo mv /etc/asterisk/extensions.conf /etc/asterisk/extensions.conf.bak

```

### 2. Create Endpoints (`pjsip.conf`)

This defines the "Usernames" and "Passwords" for the phones.

* **File:** `/etc/asterisk/pjsip.conf`

```ini
; === Transport Layer (UDP Port 5060) ===
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0

; === Extension 1001 ===
[1001]
type=endpoint
context=phones
disallow=all
allow=ulaw
auth=1001-auth
aors=1001

[1001-auth]
type=auth
auth_type=userpass
username=1001
password=1001  ; Change for security

[1001]
type=aor
max_contacts=1

; === Extension 1002 ===
[1002]
type=endpoint
context=phones
disallow=all
allow=ulaw
auth=1002-auth
aors=1002

[1002-auth]
type=auth
auth_type=userpass
username=1002
password=1002

[1002]
type=aor
max_contacts=1

```

### 3. Create Dial Logic (`extensions.conf`)

This tells the system "When someone dials 1001, ring the phone 1001."

* **File:** `/etc/asterisk/extensions.conf`

```ini
[phones]
; Dial logic for any 4-digit number starting with 1
exten => _1XXX,1,NoOp(Call for ${EXTEN})
 same => n,Dial(PJSIP/${EXTEN},20)
 same => n,Hangup()

```

---

## 📱 Step 4: Connecting the NEC Phones

Now we configure the physical phones to talk to our new server.

1. **Find Phone IP:** Press `Menu` -> `Status` -> `Network` on the NEC phone.
2. **Web Login:** Open a browser and type the IP (e.g., `http://192.168.50.33`).
* *Default User/Pass is often `Admin` / `6633222` or `1234`.*


3. **SIP Settings:**
* **SIP Server Address:** `192.168.50.32` (Your Pi's IP)
* **SIP User ID:** `1001`
* **Authenticate ID:** `1001`
* **Password:** `1001`


4. **Save & Reboot.**

---

## ✅ Step 5: The "First Call" Test

1. **Restart Asterisk:** `sudo systemctl restart asterisk`
2. **Check Registration:**
```bash
sudo asterisk -rx "pjsip show endpoints"

```


*Result: Should show **Avail** (Available).*
3. **Make a Call:** Pick up Phone 1001 and dial **1002**.
*Result: Phone 1002 should ring! (Default "Ring-Ring" sound).*

---

**Next Phase:** [Link to your "Custom Music Fix" writeup]
