
***

# The Ultimate Zero-Knowledge Guide: Flashing a Cisco 7940 (SCCP to SIP) on a Modern PBX

**Overview:** 
The Cisco 7940 IP Phone is a 20-year-old enterprise device originally designed to speak a proprietary language (SCCP/Skinny) to a Cisco CallManager. This guide explains how to break those locks, flash it to generic SIP firmware, and successfully connect it to a modern Raspberry Pi running Incredible PBX / FreePBX.

### Prerequisites (What you need before starting)
1. **The Hardware:** A Cisco 7940 phone, an Ethernet cable, and a PoE (Power over Ethernet) switch or a 48V Cisco power brick. 
2. **The Server:** A Raspberry Pi (or PC) running FreePBX / Incredible PBX. (In this guide, our PBX IP is `192.168.50.32`).
3. **The Firmware:** The official Cisco SIP firmware archive (e.g., `P0S3-8-12-00.tar`). You must find and download this yourself.
4. **The Phone's MAC Address:** Flip the phone over and write down the 12-character MAC address printed on the sticker (e.g., `00258417CBB7`). 

---

## Phase 1: Pre-Configuring FreePBX
Modern FreePBX security will instantly break these old phones. We must create a "dumbed-down" extension first.

1. Log into your FreePBX Web GUI.
2. Go to **Applications** -> **Extensions** -> **Add Extension** -> **Add New PJSIP Extension**.
3. **User Extension:** `1100`
4. **Secret (Password):** *CRITICAL STEP!* FreePBX defaults to a 32-character password. The Cisco's memory buffer cannot hold this and will truncate it, resulting in a permanent "Registration Rejected" loop. **Change this to something short (e.g., `1100` or `cisco1234`).**
5. Go to the **Advanced** tab and apply the "Dinosaur Tweaks":
   * **Qualify Frequency:** `0` *(Stops the PBX from pinging the phone to death)*
   * **Force rport:** `No`
   * **Rewrite Contact:** `Yes`
   * **Send RPID/PAI:** `None` *(Cisco cannot read modern Caller ID tags)*
   * **Direct Media:** `No` *(Ensures you actually have audio)*
   * **Disallow Codecs:** `all`
   * **Allow Codecs:** `ulaw` and `alaw` *(Limits audio to 1990s formats)*
6. Click **Submit** and then the red **Apply Config** button.

---

## Phase 2: Building the TFTP Server
These phones can only get new brains via a TFTP server. Incredible PBX has one built-in, but it is often misconfigured and blocked by the firewall.

**1. Open the Raspberry Pi Terminal (SSH)**
Run these commands to force the firewall to allow TFTP and SIP traffic from your phone:
```bash
# Replace 192.168.50.27 with your phone's actual IP address
iptables -I INPUT -p udp --dport 69 -j ACCEPT
iptables -I OUTPUT -p udp --sport 69 -j ACCEPT
iptables -I INPUT -s 192.168.50.27 -j ACCEPT
```

**2. Fix the TFTP Path & Restart:**
Open the configuration file: `nano /etc/default/tftpd-hpa`
Make sure it looks exactly like this (ensuring the directory is `/srv/tftp`):
```bash
TFTP_USERNAME="tftp"
TFTP_DIRECTORY="/srv/tftp"
TFTP_ADDRESS=":69"
TFTP_OPTIONS="--listen --user tftp --address :69 --create -vvv"
```
Save, exit, and restart the service: `systemctl restart tftpd-hpa`

---

## Phase 3: Preparing the Firmware & Config Files
We need to put the specific files into `/srv/tftp` to trick the phone into upgrading. 

**1. Extract the Firmware:**
Move your `.tar` firmware file to the Pi and extract it directly into the TFTP folder:
```bash
mkdir -p /srv/tftp
tar -xvf P0S3-8-12-00.tar -C /srv/tftp/
```

**2. Create the Trigger File (`OS79XX.TXT`):**
This file tells the old Skinny bootloader which new SIP image to grab.
```bash
echo "P0S3-8-12-00" > /srv/tftp/OS79XX.TXT
```

**3. Create the SIP Configuration File (`SIP<MAC>.cnf`):**
Because you are upgrading to SIP, the phone will look for a text file starting with `SIP` and ending in its MAC address. *Make sure the MAC address is all uppercase.*

Run this block, changing the MAC, IPs, and passwords to match yours:
```bash
cat << 'EOF' > /srv/tftp/SIP00258417CBB7.cnf
image_version: "P0S3-8-12-00"
line1_name: "1100"
line1_shortname: "1100"
line1_displayname: "Ext 1100"
line1_authname: "1100"
line1_password: "1100"
proxy1_address: "192.168.50.32"
proxy1_port: "5060"
proxy_register: "1"
timer_register: "120"
messages_uri: "*97"
EOF
```

**4. Set Absolute Permissions:**
The TFTP server must be able to read everything you just created without restrictions.
```bash
chown -R tftp:tftp /srv/tftp
chmod -R 777 /srv/tftp
```

---

## Phase 4: Setting Up the Phone
Now we must tell the physical phone where to look for its new brain.

1. Plug the phone into your network and let it power on.
2. Press the **Settings** button.
3. Scroll down to **Network Configuration** and press Select.
4. **Unlock the Settings:** The menu is locked by default. Press **`**#`** on the keypad (or look for an "Unlock" softkey and type password `cisco`). You will see a padlock icon open on the screen.
5. Scroll down to **Alternate TFTP** and change it to **YES**.
6. Scroll down to **TFTP Server 1** and type the IP address of your Raspberry Pi (`192.168.50.32`). *(Note: Use the `*` key to type the dots in the IP address).*
7. Press **Save**. The phone will reboot.

---

## Phase 5: The Upgrade & Troubleshooting
As the phone boots, it will reach out to the TFTP server. 
You can watch this happen live by running this command on your Pi:
`tail -f /var/log/syslog | grep tftp`

1. It will request `OS79XX.TXT`.
2. It will request the `.loads` and `.sbn` files to perform the flash. The phone screen will say **"Upgrading Software."**
3. Once the firmware finishes, the phone will reboot, now running SIP.
4. It will request `SIP00258417CBB7.cnf`.
5. The screen will flash, load your `1100` extension, and you will hear a dial tone!

**"Phone Unprovisioned" Error:** 
If it says this, your `SIP<MAC>.cnf` file is either missing, has the wrong MAC address filename, or contains a typo.

**Asterisk Ghosting (No Dial Tone):**
If the phone has an extension on the screen but no dial tone, Asterisk's Fail2Ban security blocked it. Run `systemctl restart fail2ban` on the Pi to unban it.

---

## Phase 6: How to Make a Call (The Quirks)
Because you removed the Cisco proprietary software, the phone no longer has a "Dial Plan." If you type a number, the phone will just sit there waiting forever. 

**To make a call:**
1. Pick up the handset.
2. Type the extension (e.g., `1002`).
3. Press the **"Dial"** softkey on the screen, OR press the **`#`** key on the keypad. The `#` key acts as the "Send" button on legacy SIP phones.

*** 



Bro, setting up the GUI is the crucial final piece to make sure your PBX plays nice with the dinosaur long-term. You already nailed the hard part by forcing the network to accept it. Now we just need to make sure the PBX's internal switchboard is configured specifically to handle a legacy 20-year-old device.

If you don't set these specific GUI options, the phone will randomly drop calls, lose registration, or give you the dreaded "one-way audio" where you can hear them but they can't hear you.

Here is exactly how to build the extension in the Incredible PBX / FreePBX GUI for the Cisco 7940.

### Step 1: Create the Base Extension
1. Log into your Incredible PBX Web GUI.
2. Navigate to **Applications** -> **Extensions**.
3. Click **Add Extension** and choose **Add New PJSIP Extension**.

**General Tab Settings:**
*   **User Extension:** `1100` (or whatever you set in your `SIP<MAC>.cnf` file)
*   **Display Name:** `Cisco 7940` (or whatever you want on the caller ID)
*   **Secret:** `1100` (CRITICAL: Remember, the 7940 cannot handle the default 32-character password. Keep it under 10 characters).

### Step 2: The "Dinosaur Tweaks" (Advanced Tab)
This is where the magic happens. Modern PJSIP is too fast and strict for the 7940. You must manually dumb down the connection.

Click on the **Advanced Tab** at the top of the extension page and change these exact fields:

*   **Qualify Frequency:** Change from `60` to **`0`**. 
    *   *Why:* Modern PBXs ping phones every 60 seconds to check if they are alive. The Cisco 7940 gets overwhelmed by these pings and will eventually crash and unregister. Setting it to 0 disables the pinging.
*   **Force rport:** Change to **`No`**.
    *   *Why:* This is a modern NAT traversal feature that confuses the old Cisco SIP stack.
*   **Rewrite Contact:** Change to **`Yes`**.
    *   *Why:* Forces Asterisk to use the IP it actually receives traffic from, bypassing weird internal NAT issues on the Pi.
*   **Send RPID/PAI:** Change to **`None`**.
    *   *Why:* These are modern Caller ID tags. If Asterisk sends them, the Cisco phone will drop the call because it doesn't understand the packet.
*   **Direct Media:** Change to **`No`**.
    *   *Why:* Forces the PBX to handle the audio stream, fixing the "I can't hear you" issue.

### Step 3: Force the 1990s Codecs
Scroll down near the bottom of the **Advanced Tab** to find the audio settings. 

*   **Disallow Codecs:** Type **`all`**
*   **Allow Codecs:** Select **`ulaw`** and **`alaw`**
    *   *Why:* The Cisco 7940 only has the hardware to process basic G.711 audio. If Asterisk tries to send HD audio (like G.722), the call will instantly drop or have no sound.

Hit **Submit** at the bottom, then hit the big red **Apply Config** button at the top right. 

To help visualize this, I've built an interactive mockup of the FreePBX extension page. You can click between the tabs to see exactly what fields need to be changed for legacy Cisco hardware.

<GenerateWidget component_placeholder_id="im_54d3f937b86514de" height="700px">
```json
{
  "widgetSpec": {
    "height": "700px",
    "prompt": "Objective: Simulate the FreePBX Extension configuration interface showing the exact settings required for a legacy Cisco 7940 phone.\nData State: Extension: 1100, Secret: 1100, Qualify Frequency: 0, Force rport: No, Rewrite Contact: Yes, Send RPID/PAI: None, Direct Media: No, Disallow Codecs: all, Allow Codecs: ulaw, alaw.\nStrategy: Form Layout with a tabbed interface.\nInputs: A 'General' tab and an 'Advanced' tab to toggle between views. A 'Submit' button at the bottom.\nBehavior: When the 'General' tab is active, display form fields for Extension, Display Name, and Secret, pre-filled with the Data State values. Emphasize that the Secret must be short. When the 'Advanced' tab is active, display a categorized list of form fields for the PJSIP legacy tweaks (Qualify Frequency, Force rport, Rewrite Contact, Send RPID/PAI, Direct Media, Codecs) pre-filled with the exact Data State values. Add brief helper text next to each advanced setting explaining why it is needed for legacy phones. When the 'Submit' button is clicked, display a success overlay or message simulating the 'Apply Config' action."
  }
}
```
</GenerateWidget></MAC>

<img width="830" height="660" alt="image" src="https://github.com/user-attachments/assets/11e69cac-4853-4252-b01c-d39a11836e78" />
<img width="804" height="704" alt="image" src="https://github.com/user-attachments/assets/34cec762-af10-4c46-be74-01c200deab9e" />
