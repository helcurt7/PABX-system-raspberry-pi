Bro, setting up another physical NEC phone exactly like your 1002 is going to feel like a vacation compared to the 5G firewall battles you just fought. 

Because the physical desk phone sits safely inside the office on the same local network as your Raspberry Pi, you do not need any of the DuckDNS, SSL certificates, or WebRTC encryption hacks. 

Here is the exact setup to clone the "1002 hardware profile" for a new NEC phone (let's call it extension `1004`).
<img width="902" height="812" alt="image" src="https://github.com/user-attachments/assets/10225074-10a4-4ed2-bd7a-adbc41f4644f" />

### Part 1: The FreePBX "Hardware" Profile
1. Log into FreePBX, go to **Applications > Extensions**, and **Add New PJSIP Extension**.
2. Set the User Extension to `1004` and give it a Display Name.
3. **Copy the Secret** (password). You will need to paste this into the physical phone.
4. Go to the **Advanced** tab and set it up EXACTLY like this (this strips away the browser security so the physical phone can understand the audio):
   * **Enable WebRTC:** Set to **No** *(Crucial!)*
   * **Media Encryption:** Set to **None**
   * **Direct Media:** Set to **No** *(This forces the Pi to stay in the middle and translate the audio when calling your web app)*
   * **Disallow Codecs:** Type `all`
   * **Allow Codecs:** Type `ulaw`
5. Click Submit, Apply Config, and run `fwconsole restart` in your Pi terminal.

### Part 2: Find the NEC Phone's IP Address
Now you have to inject those settings into the physical phone's brain.
1. Plug the NEC phone into your network and power it on.
2. Press the **Menu** or **OK** button on the phone keypad, navigate to **Status** > **Network** (or sometimes just hit the "Up" arrow), and look for its **IP Address** (e.g., `192.168.1.50`).

### Part 3: The NEC Web Interface
1. Open your laptop's browser and type that IP address into the URL bar.
2. Log in to the phone. *(If it's factory fresh, NEC SIP phones usually use `admin` for the username, and the password is `admin`, `0000`, or printed on the sticker on the back of the phone).*
3. Navigate to the **Account**, **SIP**, or **Line 1** settings tab. 
4. Fill in these exact fields to lock it to the Pi:
   * **Account Active:** Yes
   * **SIP Server / Proxy Server:** Your Raspberry Pi's *Local IP Address*. (Do NOT use your DuckDNS link here! The hardware needs the local network path).
   * **SIP User ID / Extension:** `1004`
   * **Authenticate ID:** `1004`
   * **Authenticate Password:** Paste the Secret you copied from FreePBX.
5. *Bonus step:* Find the **Audio** or **Codec** tab in the phone's menu. Make sure **PCMU** (which is hardware-speak for the `ulaw` codec we set in FreePBX) is at the very top of the priority list.

Click **Save** and reboot the phone. Once it boots up, you should see a solid green light or a "Registered" icon on the screen. Pick up the handset and dial `101`—it will route through the Pi, encrypt the audio perfectly, and ring your browser!
