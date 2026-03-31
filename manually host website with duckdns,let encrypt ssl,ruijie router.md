Hosting on Windows is surprisingly straightforward, especially since you already understand the core network concepts. The router port forwarding and the DuckDNS setup remain exactly the same. The only thing that changes is the software you use to serve the files. 

Instead of Linux's **Apache**, we will use **Nginx for Windows** (it's faster and the industry standard for Node.js apps). Instead of the Linux terminal, we will use **Git Bash** (which you likely already have installed if you use VS Code and GitHub) so you can use the exact same Let's Encrypt script.

Here is your master copy-and-paste guide for hosting your full-stack app natively on a Windows machine.

***

# Master Setup Guide: Hosting a Full-Stack Web App on Windows

## Overview
To host a React + Express application on Windows, we will use **PM2** to keep your backend API running 24/7, **Nginx** to act as your main web server (serving the React front-end and proxying traffic to the backend), and **Git Bash** to bypass the ISP Port 80 block and generate our free Let's Encrypt SSL certificate via DuckDNS.

---

### Phase 1: Keep Your Express Backend Running (PM2)
If you just run `node server.js` in a normal terminal, your API will crash the second you close the window. We need a process manager.

1. Open your standard Windows Command Prompt or PowerShell as **Administrator**.
2. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```
3. Navigate to your Express backend folder and start the server:
   ```bash
   cd C:\Users\YourName\Documents\my-webapp\backend
   pm2 start index.js --name "my-api"
   ```
4. Tell PM2 to save this list and start automatically if your Windows PC reboots:
   ```bash
   npm install -g pm2-windows-startup
   pm2-startup
   pm2 save
   ```

### Phase 2: Generate the Free SSL Certificate (Bypassing ISP Block)
Because your ISP blocks Port 80, we must use the DuckDNS DNS challenge again. Since `acme.sh` is a Linux script, we will run it using **Git Bash** (a tool that gives Windows a Linux-like terminal).

1. Open **Git Bash** as an Administrator.
2. Install the `acme.sh` script:
   ```bash
   curl https://get.acme.sh | sh -s email=your_email@gmail.com
   ```
3. Close Git Bash, reopen it, and export your DuckDNS token:
   ```bash
   export DuckDNS_Token="your-duckdns-token-here"
   ```
4. Issue the certificate for your domain:
   ```bash
   ~/.acme.sh/acme.sh --issue --dns dns_duckdns -d mywebapp.duckdns.org
   ```
*(Take note of where it saves the `fullchain.cer` and `.key` files. It will usually be in `C:\Users\YourName\.acme.sh\mywebapp.duckdns.org_ecc\`)*

### Phase 3: Install and Configure Nginx (The Web Server)
Nginx will listen for web traffic on Port 443, serve your compiled React files, and securely pass API requests to your PM2 Express server.

1. Download the latest stable version of **Nginx for Windows** from `nginx.org` and extract the `.zip` file directly to the root of your C: drive (e.g., `C:\nginx`).
2. Copy your compiled React front-end (your `build` folder) into the Nginx HTML folder: `C:\nginx\html\`.
3. Open the Nginx configuration file in Notepad: `C:\nginx\conf\nginx.conf`.
4. Delete everything inside and paste this configuration:

```nginx
events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # Redirect all local HTTP traffic to HTTPS
    server {
        listen       80;
        server_name  mywebapp.duckdns.org;
        return 301 https://$host$request_uri;
    }

    # The Secure HTTPS Server
    server {
        listen       443 ssl;
        server_name  mywebapp.duckdns.org;

        # Point these to the files acme.sh generated (Use forward slashes!)
        ssl_certificate      "C:/Users/YourName/.acme.sh/mywebapp.duckdns.org_ecc/fullchain.cer";
        ssl_certificate_key  "C:/Users/YourName/.acme.sh/mywebapp.duckdns.org_ecc/mywebapp.duckdns.org.key";

        # 1. Serve the React Front-End
        location / {
            root   html;
            index  index.html index.htm;
            # Fixes React Router page refreshes
            try_files $uri $uri/ /index.html; 
        }

        # 2. Proxy API requests to your Express backend (running on Port 3000)
        location /api/ {
            proxy_pass http://127.0.0.1:3000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```
5. Save the file. Double-click the `nginx.exe` file inside your `C:\nginx` folder to start the server. *(A quick black window will flash—this means it's running in the background).*

### Phase 4: Network Routing & Windows Firewall
This is the step that trips everyone up. Your router might be forwarding the traffic, but Windows has its own strict internal firewall that will block external web traffic by default.

**1. Windows Defender Firewall:**
* Click the Windows Start button and type **Windows Defender Firewall with Advanced Security**.
* Click **Inbound Rules** on the left.
* Click **New Rule...** on the right.
* Choose **Port** -> **TCP**.
* Specify Local Ports: `80, 443` -> Allow the connection -> Name it "Web Server Ports".

**2. Ruijie Hardware Router:**
* Log into your router and point the Port Forwarding rules to the local IP of your Windows PC (e.g., `192.168.50.45`):
  * **Rule 1:** External `443` -> Internal `443` (TCP)
  * **Rule 2:** External `80` -> Internal `80` (TCP)

### Phase 5: Verification
Turn off your phone's WiFi, switch to 5G/4G, and type `https://mywebapp.duckdns.org` into your mobile browser. You should see your React app load securely, and it should be able to pull data from your Express API perfectly.

***

Because you used Git Bash and `acme.sh`, that same 90-day automatic renewal cron job is already quietly running in the background on Windows, exactly like it did on Linux! 

How does this Windows workflow feel compared to the Pi?



Here is the complete, beginner-friendly master document for your coding workflows. You can copy and paste this directly into your project notes alongside your network setup guides.

***

# Master Setup Guide: Developing and Deploying Full-Stack Applications on a Home Server

## Overview
Coding a complex full-stack web application (like React and Express) using a basic terminal editor like `nano` is highly inefficient. To bridge the gap between your local laptop (where you write code) and your Raspberry Pi (where the server actually runs), we use two professional workflows. 

**Workflow 1 (Remote-SSH)** is best for active development and tweaking files directly on the server. **Workflow 2 (Git & GitHub)** is the industry standard for deploying finished code like a true CI/CD pipeline.

---

### Phase 1: Workflow 1 - The "Magic" Way (VS Code Remote - SSH)

This method uses an official Microsoft extension to connect your local Visual Studio Code directly to the Raspberry Pi. It looks and feels exactly like you are coding on your laptop, but every file you save and every terminal command you run happens physically on the server.

**Step 1: Install the Extension**
1. Open **Visual Studio Code** on your laptop.
2. Click on the **Extensions** icon on the far left sidebar (it looks like 4 square blocks).
3. In the search bar, type: `Remote - SSH`.
4. Look for the one published by **Microsoft** and click **Install**.

**Step 2: Connect to the Server**
1. Press **F1** (or `Ctrl + Shift + P` on Windows) to open the Command Palette at the top of the screen.
2. Type `Remote-SSH: Connect to Host...` and press **Enter**.
3. Select **+ Add New SSH Host...** from the dropdown menu.
4. Type your exact SSH login command (the same one you use in your terminal). Example:
   ```bash
   ssh root@192.168.50.32
   ```
5. Press **Enter**, and select the first configuration file option it offers (usually `C:\Users\YourName\.ssh\config`).
6. A prompt will appear in the bottom right corner. Click **Connect**. 
*(Note: A new VS Code window will open. If it asks for the server platform, select **Linux**, and type your server password if prompted).*

**Step 3: Open Your Project Folder**
1. In this new connected window, click the **Explorer** icon on the top left.
2. Click the **Open Folder** button.
3. A dropdown menu will appear showing the folders *on the Raspberry Pi*. Select the folder where your web project lives (for example, `/var/www/html` or `/root/my-express-app`) and click **OK**.

**Step 4: Use the Integrated Terminal**
1. Press `` Ctrl + ` `` (the tilde key next to the number 1) to open the terminal inside VS Code.
2. You are now inside the Raspberry Pi terminal. You can run standard Node.js commands directly on the hardware:
   ```bash
   npm install
   npm start
   npm run build
   ```
*Whenever you edit a file and press `Ctrl + S`, the changes are instantly saved to the Pi.*

---

### Phase 2: Workflow 2 - The "Proper CI/CD" Way (Git & GitHub)

This is the industry standard for production environments. You completely separate your "Development" environment (your laptop) from your "Production" environment (the Raspberry Pi).

**Step 1: Develop Locally**
1. Write all your code, test your user interface, and run your local Express servers entirely on your laptop using standard VS Code.
2. Ensure everything works perfectly on `localhost` before moving to the next step.

**Step 2: Push to the Cloud (GitHub)**
When your feature is finished and ready for the world to see, save it to a cloud repository.
1. Open your local terminal in VS Code.
2. Add, commit, and push your code to GitHub:
   ```bash
   git add .
   git commit -m "Finished the new login page and API routes"
   git push origin main
   ```

**Step 3: Pull to the Server (Raspberry Pi)**
Now, tell the server to download the exact code you just pushed.
1. Open a standard SSH terminal to your Raspberry Pi: `ssh root@192.168.50.32`
2. Navigate to your project folder:
   ```bash
   cd /var/www/html/my-project
   ```
3. Pull the fresh code down from GitHub:
   ```bash
   git pull origin main
   ```

**Step 4: Build and Restart Services**
Depending on what kind of app you pushed, you need to tell the server to apply the changes.

* **For a Front-End App (React, Vue, HTML):**
  Rebuild the static files so Apache can serve them.
  ```bash
  npm run build
  ```
* **For a Back-End App (Express, Node.js):**
  Restart your Node server so it picks up the new API routes. If you are using `pm2` (a popular process manager for Node), run:
  ```bash
  pm2 restart my-express-app
  ```
