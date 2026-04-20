Bro, adding more WebRTC extensions is super easy now that you’ve already fought the "Final Boss" of network firewalls and codecs. You’ve basically engineered the perfect blueprint.

To add another WebRTC extension (like `103` or `104`), you just need to stamp out a new PJSIP extension using the exact "Failsafe Profile" we built for 101. 

Here is your exact SOP (Standard Operating Procedure) to stamp out as many WebRTC extensions as you want in under 2 minutes each.

### Step 1: Create the Base Extension
1. Log into FreePBX and go to **Applications** > **Extensions**.
2. Click **Add Extension** > **Add New PJSIP Extension**.
3. **User Extension:** Enter your new number (e.g., `103`).
4. **Display Name:** Give it a name (e.g., `Web User 2`).
5. **Secret:** Copy this password! You will need to paste it into your web app later.

### Step 2: Apply the "WebRTC Master Profile" (Advanced Tab)
Click over to the **Advanced** tab. We are going to apply every single fix you discovered during your testing.

**The "Reveal" Hack:**
* Find **Enable WebRTC** and set it to **No**. (Remember, FreePBX hides the advanced settings if this is set to Yes. We need manual control!)

**The 5G Network Fixes:**
* **Rewrite Contact:** Set to **Yes**
* **Force rport:** Set to **Yes**
* **RTP Symmetric:** Set to **Yes**
* **Qualify:** Set to **Yes**
* **Qualify Frequency:** Set to **15** *(This keeps the 5G auto-hangup working!)*

**The Physical Phone Bridge Fix:**
* **Direct Media:** Set to **No** *(This stops the browser from rejecting unencrypted audio from the NEC desk phones).*

**The Encryption & Codec Rules:**
* **Enable AVPF:** Set to **Yes**
* **Force AVPF:** Set to **Yes**
* **ICE Support:** Set to **Yes**
* **Media Encryption:** Set to **DTLS-SRTP**
* **Disallow Codecs:** Type `all`
* **Allow Codecs:** Type `ulaw` *(Forces perfect compatibility with 1002).*

**The DTLS Certificate Rules (Scroll down to DTLS section):**
* **Enable DTLS:** Set to **Yes**
* **Use Certificate:** Select your **duckdns** Let's Encrypt certificate.
* **DTLS Verify:** Set to **Fingerprint**
* **DTLS Setup:** Set to **Act/Pass**
* **DTLS Rekey Interval:** Set to **0**

### Step 3: Apply and Restart
1. Click **Submit**.
2. Click the red **Apply Config** button at the top.
3. Jump into your Raspberry Pi terminal and run:
   ```bash
   fwconsole restart
   ```

### How to test your new extension
Because your HTML/JS code is dynamic, you do not need to change a single line of your web code! 

1. Open your web app in your normal Chrome window. Connect as `101`.
2. Open a **New Incognito Window** (`Ctrl+Shift+N`) and open your web app again.
3. In the Incognito window, change the Extension box to `103` and paste the new Secret you copied in Step 1.
4. Click **Connect**. 

You can now call `101` from `103` right there on your own laptop to test browser-to-browser calling, or have `103` call the `1002` desk phone! You can repeat this exact checklist to make as many WebRTC users as the office needs.
Ah, my bad! You are totally right. We talked so much about the JavaScript side that I completely skipped over the **Asterisk/FreePBX side**. 

You nailed it. It takes two to tango. If Chrome is sending a "Muxed" (combined) audio stream, Asterisk *must* be configured to catch it. If Asterisk has Mux turned off, it will literally look at Chrome's audio packets, say *"What is this?"*, and drop the call.

Here is the exact write-up for the **FreePBX WebRTC Extension Settings**, including the Mux toggle and the other required security toggles. 

---

### The FreePBX WebRTC Extension Checklist
To make a WebRTC call work, you cannot just use a standard SIP extension. You have to go into the specific extension (e.g., 101, 102) and flip a few deep security switches to turn it into a WebRTC endpoint.

**Where to go:**
1. Log into FreePBX.
2. Go to **Applications** -> **Extensions**.
3. Click the pencil icon to edit your WebRTC extension (e.g., 101).
4. Click on the **Advanced** tab at the top.

Scroll down through the Advanced tab and make sure these exact settings are flipped. I call these the **"Holy Quaternity" of WebRTC**:

#### 1. Enable rtcp_mux: `Yes`
* **What it does:** This is the exact setting you remembered! It tells Asterisk to expect the Voice (RTP) and the Statistics (RTCP) to be mashed together on a single port. If this is `No`, Asterisk waits for a second port to open, times out, and kills the audio.

#### 2. Enable AVPF: `Yes`
* **What it does:** AVPF stands for *Audio-Visual Profile with Feedback*. WebRTC requires lightning-fast feedback about packet loss so it can adjust the audio quality on the fly. Standard SIP doesn't use this, but WebRTC demands it. 

#### 3. Enable ICE Support: `Yes`
* **What it does:** We talked a lot about ICE (the maps Chrome uses to find Asterisk). This toggle tells Asterisk to actually read those maps and build the secure tunnel. If this is `No`, Asterisk tries to route the call using old-school IP rules, hitting the 5G firewall and failing.

#### 4. Media Encryption: `DTLS-SRTP`
* **What it does:** WebRTC absolutely refuses to send unencrypted voice data over the internet. It requires bank-level encryption. 
    * Set **Media Encryption** to `DTLS-SRTP`.
    * Right below it, make sure **Enable DTLS** is set to `Yes`.
    * Ensure **Use Certificate** is set to your active SSL certificate (usually the Let's Encrypt or Default cert).

### The Golden Rule of FreePBX WebRTC
If you ever create a brand new extension for a laptop or web browser in the future, **always double-check that Advanced tab**. 

By default, FreePBX creates standard desktop-phone extensions with `rtcp_mux`, `AVPF`, and `Encryption` turned **OFF**. You always have to manually go in and flip them to **YES** to allow the browser to connect!
