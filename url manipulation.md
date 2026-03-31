Here is the ultimate URL manipulation cheatsheet, documented and formatted so you can easily drop it into your notes. 

These are the kind of tricks that save massive amounts of time when you're hunting for hidden endpoints during a Web CTF, scraping data for an Express backend, or just trying to bypass bloated frontends.

---

### 📂 The Google Workspace Arsenal
Google's routing allows you to completely change how a document behaves just by swapping out the end of the URL (everything after the document ID). 

* **The Barebones Render:** `/htmlview`
    * **Syntax:** `.../d/[DOCUMENT_ID]/htmlview`
    * **What it does:** Strips all Google UI, toolbars, and heavy JavaScript payloads. Returns a pure, server-side rendered HTML table.
    * **The Play:** Maximum load speed. Ideal for quick reading or simple web scraping without dealing with a complex DOM.
* **The Clean Embed:** `/preview`
    * **Syntax:** `.../d/[DOCUMENT_ID]/preview`
    * **What it does:** Removes editing tools but keeps the original styling and formatting intact. 
    * **The Play:** Perfect for embedding an `iframe` into a custom dashboard or application without it looking like a clunky spreadsheet.
* **The Force Clone:** `/copy`
    * **Syntax:** `.../d/[DOCUMENT_ID]/copy`
    * **What it does:** intercepts the page load and forces the user to save a duplicate directly to their own Drive.
    * **The Play:** Sharing templates seamlessly without risking your original file or dealing with access requests.
* **The Direct API / Download:** `/export`
    * **Syntax (CSV):** `.../d/[DOCUMENT_ID]/export?format=csv`
    * **Syntax (PDF):** `.../d/[DOCUMENT_ID]/export?format=pdf` *(Note: Append `&gid=[SHEET_ID]` if targeting a specific tab).*
    * **What it does:** Turns the URL into an instant, direct download link.
    * **The Play:** You can use a Sheet as a lightweight, makeshift database. Just write a `fetch` or `axios` request in your Node/Express backend to hit the CSV export URL and parse the data instantly.

### 🌐 The Universal Web Architecture Hacks
These exploit standard web protocols, routing behaviors, and search engine rules that apply to a huge portion of the internet.

* **The Cache Buster:** `?nocache=[RANDOM_NUMBER]`
    * **Syntax:** `https://example.com/styles.css?v=12345` (Always use `?` for the first parameter, `&` for subsequent ones).
    * **What it does:** Tricks Content Delivery Networks (CDNs) into thinking you are requesting a brand-new file, bypassing the saved (cached) version.
    * **The Play:** Forcing CSS or static assets to update during development. Usually implemented programmatically (e.g., appending `Date.now()`) so the browser always fetches the freshest code.
* **The Raw Data Extractor:** `.json`
    * **Syntax:** `https://www.reddit.com/r/programming.json`
    * **What it does:** On platforms built to serve both UI and APIs from the same routes (like Reddit or Shopify), adding `.json` strips the React frontend and returns the raw JSON object.
    * **The Play:** The ultimate scraping shortcut. Bypasses the need for headless browsers and gives you clean, structured data ready to be parsed.
* **The Recon Maps:** `/robots.txt` & `/sitemap.xml`
    * **Syntax:** `https://example.com/robots.txt`
    * **What it does:** Accesses the files designed to instruct search engine crawlers on what to index and what to ignore.
    * **The Play:** Mandatory first steps in any Web CTF or bug bounty. `robots.txt` often reveals hidden admin directories, beta environments, or private API endpoints that developers explicitly wanted to hide.
* **The Basic Auth Bypass:** Embedded Credentials
    * **Syntax:** `https://username:password@example.com`
    * **What it does:** Passes Basic Authentication credentials directly to the server via the URL before the browser throws the manual login popup.
    * **The Play:** Quick access to old-school server portals, router configurations, or simple protected directories without stopping to type.

---

Would you like me to format this as a markdown file you can drop straight into the OTASK boilerplate repo for future reference?
