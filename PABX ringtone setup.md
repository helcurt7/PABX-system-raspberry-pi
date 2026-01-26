This is the **complete, zero-knowledge Master Guide**. You can copy-paste this directly into a GitHub `README.md` or a Word document for your project documentation.

It covers everything from sending the file from Windows to the final code on the Raspberry Pi.

---

# 📞 Asterisk PABX with Custom Music (NEC Hardware Fix)

**Project Goal:** Configure a Raspberry Pi to act as a PBX server for NEC IP Phones (ITX-1615), featuring custom ringback music and fixing static/audio issues.

## 📋 Prerequisites

* **Server:** Raspberry Pi running Asterisk 20+
* **Client:** Windows PC with a music file (MP3 or WAV)
* **Endpoints:** NEC IP Phones (Extensions 1001 & 1002)

---

## 🚀 Step 1: Send Music from Windows to Pi

*Run this on your **Windows** computer using PowerShell.*

1. Open **PowerShell**.
2. Type the following command (replace the path and IP with your own):

```powershell
# Syntax: scp "Path\To\Your\Music.mp3" username@pi-ip-address:/tmp/
scp "C:\Users\YourName\Downloads\my-song.mp3" root@192.168.50.32:/tmp/

```

* *It will ask for your Pi's password. Type it and press Enter.*
* *The file is now inside the `/tmp/` folder on your Raspberry Pi.*

---

## 🛠️ Step 2: Convert Audio (The NEC Fix)

*Run all following commands on your **Raspberry Pi Terminal**.*

NEC phones cannot play standard MP3 or WAV files (they cause static). We must convert the music to **Raw u-law, 8000Hz, Mono**.

```bash
# 1. Create the directory (if it doesn't exist)
sudo mkdir -p /var/lib/asterisk/moh/ringtone_only

# 2. Convert the file (Volume reduced to 50% to prevent buzzing)
# Replace 'my-song.mp3' with the actual filename you uploaded
sudo ffmpeg -y -i /tmp/my-song.mp3 -filter:a "volume=0.5" -f mulaw -ar 8000 -ac 1 /var/lib/asterisk/moh/ringtone_only/custom_ring.ulaw

# 3. Set file permissions so Asterisk can read it
sudo chown asterisk:asterisk /var/lib/asterisk/moh/ringtone_only/custom_ring.ulaw
sudo chmod 644 /var/lib/asterisk/moh/ringtone_only/custom_ring.ulaw

```

---

## ⚙️ Step 3: Configure Asterisk Files

You need to edit 4 files. Copy and paste these configurations exactly.

### A. Define the Music Class

**File:** `/etc/asterisk/musiconhold.conf`

```ini
; Scroll to the bottom and add this:
[my-ringtone]
mode=files
directory=/var/lib/asterisk/moh/ringtone_only
sort=alpha

```

### B. Configure the Phones (PJSIP)

**File:** `/etc/asterisk/pjsip.conf`
*Note: This config includes specific fixes for NEC hardware (ulaw only, symmetric RTP, no silence suppression).*

```ini
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0

; --- Extension 1001 ---
[1001]
type=endpoint
context=phones
disallow=all
allow=ulaw                 ; Force u-law codec
auth=1001-auth
aors=1001
direct_media=no
rtp_symmetric=yes          ; Fixes one-way audio
force_rport=yes
rewrite_contact=yes
timers=yes                 ; Keeps NEC connection alive
inband_progress=yes        ; Sends audio before answer
dtx=no                     ; Disables silence suppression (Fixes "Zzz")
mailboxes=1001@default     ; Fixes 404 Subscription errors

[1001-auth]
type=auth
auth_type=md5
username=1001
password=1001

[1001]
type=aor
max_contacts=1
remove_existing=yes

; --- Extension 1002 ---
[1002]
type=endpoint
context=phones
disallow=all
allow=ulaw
auth=1002-auth
aors=1002
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
timers=yes
inband_progress=yes
dtx=no
mailboxes=1002@default

[1002-auth]
type=auth
auth_type=md5
username=1002
password=1002

[1002]
type=aor
max_contacts=1
remove_existing=yes

```

### C. Configure Dial Logic

**File:** `/etc/asterisk/extensions.conf`

```ini
[phones]
exten => _1XXX,1,NoOp(Call for ${EXTEN})
 same => n,Answer()                         ; CRITICAL: Open audio path first
 same => n,Dial(PJSIP/${EXTEN},20,m(my-ringtone)) ; Play custom music
 same => n,Hangup()

```

### D. Configure Voicemail (Stop 404 Errors)

**File:** `/etc/asterisk/voicemail.conf`

```ini
[default]
1001 => 1001,Extension 1001
1002 => 1002,Extension 1002

```

---

## 🔄 Step 4: Apply Changes

Run these commands to make your settings live without restarting the server.

```bash
sudo asterisk -rx "pjsip reload"
sudo asterisk -rx "dialplan reload"
sudo asterisk -rx "moh reload"
sudo asterisk -rx "voicemail reload"

```

---

## ✅ Step 5: Verification

Run these checks to confirm success.

1. **Check Phones:** `sudo asterisk -rx "pjsip show endpoints"`
* *Result:* Should see `Not in use` (Online).


2. **Check Music:** `sudo asterisk -rx "moh show files"`
* *Result:* Should show file `/var/lib/asterisk/moh/ringtone_only/custom_ring` (Format: `ulaw`).


3. **Test Call:** Dial **1002** from **1001**.
* *Result:* You should hear your custom music clearly with **no static**.
