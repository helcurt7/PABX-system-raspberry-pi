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
