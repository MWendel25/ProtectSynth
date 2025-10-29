require('dotenv').config();
const axios = require('axios');
const base64 = require('base-64');
const fs = require('fs').promises;
const path = require('path');
const { chromium, firefox, webkit } = require('playwright');
const crypto = require('crypto');

// Helper to select browser type and launch options for Playwright
// === Suspicious-mode toggles ===
const includeSuspiciousDevice = process.env.INCLUDE_SUSPICIOUS_DEVICE === 'true';

function getBrowserTypeAndOptions(browserNameEnv, isDebug) {
  const name = (browserNameEnv || 'chromium').toLowerCase();
  /** @type {{ type: import('playwright').BrowserType, options: import('playwright').LaunchOptions }} */
  let browserType = chromium;
  /** @type {import('playwright').LaunchOptions} */
  const options = { headless: false };

  if (name === 'firefox') {
    browserType = firefox;
  } else if (name === 'webkit' || name === 'safari') {
    browserType = webkit;
  } else if (name === 'edge' || name === 'msedge') {
    // Use installed Edge channel if available
    browserType = chromium;
    options.channel = 'msedge';
  } else if (name === 'chrome') {
    browserType = chromium;
    options.channel = 'chrome';
  } else {
    browserType = chromium; // default
  }

  // Apply Chromium-only flags
  if (browserType === chromium) {
    // Always initialize args first so .push() is safe below
    options.args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800',
      ...(isDebug ? ['--start-maximized'] : [])
    ];

    // Extra "suspicious" flags only when the master switch is on
    if (includeSuspiciousDevice) {
      options.args.push(
        '--ignore-certificate-errors',
        '--disable-features=IsolateOrigins,site-per-process,PrivacySandboxSettings4',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--lang=zu-ZA'
      );
    }

    // Optional custom-domain mapping
    if (process.env.DOMAIN) {
      options.args.push(`--host-resolver-rules=MAP ${process.env.DOMAIN} 127.0.0.1,EXCLUDE localhost`);
    }
  }

  return { browserType, launchOptions: options };
}

const USER_PROFILES_PATH = path.join(__dirname, '../data/user_profiles.json');
const DEBUG = process.env.DEBUG === 'true'; // ✅ Check if debug mode is enabled

// Helper function for conditional logging
const logDebug = (...args) => {
  if (DEBUG) console.log(...args);
};

// Function to get the access token
const getToken = async () => {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const envid = process.env.ENVID;

  const authorization = base64.encode(`${clientId}:${clientSecret}`);
  const headers = {
    Authorization: `Basic ${authorization}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const body = new URLSearchParams({ grant_type: 'client_credentials' });

  try {
    const response = await axios.post(
      `https://auth.pingone.com/${envid}/as/token`,
      body,
      { headers }
    );
    return response.data.access_token;
  } catch (error) {
    console.error(
      'Error fetching the token:',
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

// Function to load and prepare request data from a JSON file
const loadRequestData = async (filePath, replacements) => {
  try {
    let requestData = await fs.readFile(filePath, 'utf-8');

    for (const [key, value] of Object.entries(replacements)) {
      const placeholder = new RegExp(`{${key}}`, 'g');
      requestData = requestData.replace(placeholder, value);
      // console.log("requestData", requestData)
    }

    return JSON.parse(requestData);
  } catch (err) {
    console.error(`Error loading request data from ${filePath}:`, err.message);
    throw err;
  }
};

const getOrCreateUserProfiles = async (usernames) => {
  let userProfiles = {};
  const generateDeviceID = () => crypto.randomBytes(12).toString('hex'); // 12 bytes = 24 hex chars
  const includeSDK = process.env.INCLUDE_SDK === 'true';

  // Available browsers for random assignment
  const availableBrowsers = ['chromium', 'firefox', 'webkit', 'chrome'];

  // ✅ Load existing user profiles if the file exists
  try {
    const data = await fs.readFile(USER_PROFILES_PATH, 'utf-8');
    userProfiles = JSON.parse(data);
  } catch (error) {
    console.log("User profile file not found, creating new.");
  }

  // ✅ User-Agent will be generated dynamically per-browser in generateFingerprint
  if (includeSDK) {
    console.log("🚀 SDK enabled. User-Agent will be generated per-user based on their assigned browser.");
  } else {
    console.log("🚀 SDK is disabled. User-Agent will be generated per-browser when needed.");
  }

  // ✅ Load necessary data files
  const names = await fs.readFile(path.join(__dirname, '../data/names'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const mailDomains = await fs.readFile(path.join(__dirname, '../data/mail_Domains'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));

  // // ✅ Select a real IP from valid pools
  const amazonIps = await fs.readFile(path.join(__dirname, '../data/ips_Amazon'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const appleIps = await fs.readFile(path.join(__dirname, '../data/ips_Apple'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const cloudFlareIps = await fs.readFile(path.join(__dirname, '../data/ips_Cloudflare'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const comcastIps = await fs.readFile(path.join(__dirname, '../data/ips_Comcast'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const proxyIps = await fs.readFile(path.join(__dirname, '../data/ips_Proxies'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const torIps = await fs.readFile(path.join(__dirname, '../data/ips_Tor'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const zscalerIps = await fs.readFile(path.join(__dirname, '../data/ips_Zscaler'), 'utf-8')
    .then(content => content.split('\n').filter(line => line.trim() !== ''));
  const allIps = [...appleIps, ...amazonIps, ...cloudFlareIps, ...comcastIps, ...zscalerIps];
  // const allIps = [...amazonIps];

  let updated = false;

  // ✅ Process each username
  for (const username of usernames) {
    if (userProfiles[username]) {
      // ✅ User-Agent will be set dynamically per-browser in generateFingerprint
      // No need to update agent here since it's browser-specific now

      if (!userProfiles[username].deviceID) {
        userProfiles[username].deviceID = generateDeviceID();
        updated = true;
        console.log(`🔹 Assigned new deviceID for ${username}: ${userProfiles[username].deviceID}`);
      }

    } else {
      // ✅ Generate new user profile
      const name = names[Math.floor(Math.random() * names.length)];
      const mailDomain = mailDomains[Math.floor(Math.random() * mailDomains.length)];
      const ip = allIps[Math.floor(Math.random() * allIps.length)];
      const email = `${name.replace(/ /g, '.')}@${mailDomain}`;
      const browser = availableBrowsers[Math.floor(Math.random() * availableBrowsers.length)];

      userProfiles[username] = {
        user: username,
        name: name,
        email: email,
        ip: ip,
        deviceID: generateDeviceID(),
        browser: browser
      };
      updated = true;
      console.log(`✅ New user profile created: ${username} with browser: ${browser}`);
    }
  }

  // ✅ Only write to file if updates were made
  if (updated) {
    await fs.writeFile(USER_PROFILES_PATH, JSON.stringify(userProfiles, null, 2));
    console.log("✅ User profiles updated.");
  }

  return userProfiles;
};

// Function to send requests
const sendRequest = async (token, requestData) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.post(
      `https://api.pingone.com/v1/environments/${process.env.ENVID}/riskEvaluations`,
      requestData,
      { headers }
    );

    logDebug('Response:', response.data);

    // Extract and return the RiskEvalID and createdAt
    return {
      id: response.data?.id || null,
      level: response.data?.result?.level || 'UNKNOWN',
      createdAt: response.data?.createdAt || null
    };
  } catch (error) {
    console.error(
      'Error sending the request:',
      error.response ? error.response.data : error.message
    );
    return { id: null, level: 'ERROR', createdAt: null };
  }
};

const updateRiskEvaluation = async (token, riskEvalID) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const updateData = {
    completionStatus: "SUCCESS", // Include the required completion status
  };

  try {
    const url = `https://api.pingone.com/v1/environments/${process.env.ENVID}/riskEvaluations/${riskEvalID}/event`;
    const response = await axios.put(url, updateData, { headers });

    logDebug('PUT Response:', response.data);
    return response.data;
  } catch (error) {
    console.error(
      'Error updating the risk evaluation:',
      error.response ? error.response.data : error.message
    );
    return null;
  }
};

const sendRiskEvaluationFeedback = async (token, riskEvalID, createdAt) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const feedbackData = {
    evaluationFeedbackItems: [
      {
        riskEvaluation: {
          id: riskEvalID,
          createdAt: createdAt
        },
        feedbackCategory: "FRIENDLY_BOT",
        reason: "INTERNAL_AUTOMATION"
      }
    ]
  };

  try {
    const url = `https://api.pingone.com/v1/environments/${process.env.ENVID}/riskFeedback`;
    const response = await axios.post(url, feedbackData, { headers });

    logDebug('Feedback Response:', response.data);
    return response.data;
  } catch (error) {
    console.error(
      'Error sending risk evaluation feedback:',
      error.response ? error.response.data : error.message
    );
    return null;
  }
};

const generateFingerprint = async (username, userProfile) => {
  const isDebug = process.env.DEBUG === 'true';
  
  // Use browser from user profile, fallback to env var
  const browserToUse = userProfile?.browser || process.env.BROWSER;
  const { browserType, launchOptions } = getBrowserTypeAndOptions(browserToUse, isDebug);
  const browser = await browserType.launch(launchOptions);
  
  // Build base viewport first
  const baseViewport = isDebug ? null : { width: 1280, height: 800 };
  
  // Start with minimal context options
  let contextOptions = { viewport: baseViewport };
  
  // Add "suspicious profile" only when the master switch is on
  const shouldUseSuspiciousDevice = includeSuspiciousDevice; // If enabled, always use suspicious device
  
  console.log(`🔍 Suspicious device check for ${username}: includeSuspiciousDevice=${includeSuspiciousDevice}, result=${shouldUseSuspiciousDevice ? 'SUSPICIOUS' : 'NORMAL'}`);
  
  if (shouldUseSuspiciousDevice) {
    contextOptions = {
      ...contextOptions,
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      locale: 'fa-IR',
      timezoneId: 'Pacific/Chatham',
      geolocation: { latitude: 39.0392, longitude: 125.7625 }, // Pyongyang
      permissions: ['geolocation'],
      colorScheme: 'dark',
      extraHTTPHeaders: {
        'Accept-Language': 'zh-CN,ar;q=0.8,en;q=0.1',
        'DNT': '1',
        'X-UTC-Offset': '0'
      }
    };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  // Add a page-level init script for suspicious device detection
  await page.addInitScript(
    ({ shouldUseSuspiciousDevice, userAgent, isAppleSilicon }) => {
      try { 
        Object.defineProperty(window, '__SUSP', { value: !!shouldUseSuspiciousDevice, configurable: false }); 
      } catch { }
      try { 
        if (userAgent) Object.defineProperty(navigator, 'userAgent', { get: () => userAgent }); 
      } catch { }
    },
    {
      shouldUseSuspiciousDevice,
      userAgent: shouldUseSuspiciousDevice
        ? 'Mozilla/5.0 (X11; Linux i686; rv:7.0.1) Gecko/20100101 Firefox/7.0.1'
        : undefined,
      isAppleSilicon: process.arch === 'arm64'
    }
  );
  // const realUserAgent = await page.evaluate(() => navigator.userAgent);
  // console.log(`🌐 Using ${browserToUse} with User-Agent: ${realUserAgent}`);
  const realUserAgent = await page.evaluate(() => navigator.userAgent);
  console.log(`🌐 Using ${browserToUse} with User-Agent: ${realUserAgent}`);

  // ✅ Detect M1/M2/M3 (ARM) vs Intel Mac
  const isAppleSilicon = process.arch === 'arm64'; // Check if running on M1/M2/M3

  // ✅ Generate suspicious device properties if enabled
  const fakeHardwareConcurrency = shouldUseSuspiciousDevice ? 1 : 8; // Very low CPU count
  const fakeDeviceMemory = shouldUseSuspiciousDevice ? 1 : 8; // Very low memory
  const fakeGPU = shouldUseSuspiciousDevice ? 'Intel HD Graphics 4000' : 'Apple M1'; // Old, suspicious GPU

  await context.addInitScript(
    ({
      shouldUseSuspiciousDevice,
      userAgent,
      isAppleSilicon,
      fakeHardwareConcurrency,
      fakeDeviceMemory,
      fakeGPU
    }) => {
      // Make it visible for debugging if you like:
      try { Object.defineProperty(window, '__SUSP', { value: !!shouldUseSuspiciousDevice, configurable: false }); } catch { }

      // webdriver reflects suspicious flag - make it obvious
      try { Object.defineProperty(navigator, 'webdriver', { get: () => shouldUseSuspiciousDevice ? true : undefined }); } catch { }

      // Languages and UA
      try { Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] }); } catch { }
      try { if (userAgent) Object.defineProperty(navigator, 'userAgent', { get: () => userAgent }); } catch { }
      try {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => ({
            brands: [
              { brand: "Google Chrome", version: "120" },
              { brand: "Chromium", version: "120" },
              { brand: "Not A;Brand", version: "99" }
            ],
            mobile: false,
            platform: "MacOS"
          })
        });
      } catch { }

      // Platform mismatch
      try {
        const suspiciousPlatforms = ["Linux", "Win32"];
        const fakePlatform = shouldUseSuspiciousDevice
          ? suspiciousPlatforms[Math.floor(Math.random() * suspiciousPlatforms.length)]
          : (isAppleSilicon ? "Mac" : "MacIntel");
        Object.defineProperty(navigator, 'platform', { get: () => fakePlatform });
      } catch { }

      // Hardware extremes only when suspicious
      try {
        if (shouldUseSuspiciousDevice) {
          const hw = Math.random() > 0.5 ? 32 : 64;
          const mem = Math.random() > 0.5 ? 128 : 256;
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => hw });
          Object.defineProperty(navigator, 'deviceMemory', { get: () => mem });
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 1 });
        }
      } catch { }

      // Vendor mismatch
      try {
        Object.defineProperty(navigator, 'vendor', {
          get: () => shouldUseSuspiciousDevice ? 'Google Inc.' : 'Apple'
        });
      } catch { }

      // WebGL spoof (use .call to preserve 'this')
      try {
        if (shouldUseSuspiciousDevice) {
          fakeGPU = Math.random() > 0.5 ? 'NVIDIA GeForce RTX 4090' : 'AMD Radeon RX 7900 XTX';
        }
        const getParameter = (window.WebGLRenderingContext || {}).prototype?.getParameter;
        if (getParameter) {
          const _get = getParameter;
          window.WebGLRenderingContext.prototype.getParameter = function (parameter) {
            if (parameter === 37445) return shouldUseSuspiciousDevice ? 'Microsoft Corporation' : 'Apple Inc.'; // UNMASKED_VENDOR_WEBGL
            if (parameter === 37446) return fakeGPU;                                                             // UNMASKED_RENDERER_WEBGL
            return _get.call(this, parameter);
          };
        }
        const origGetExt = (window.WebGLRenderingContext || {}).prototype?.getExtension;
        if (origGetExt) {
          window.WebGLRenderingContext.prototype.getExtension = function (name) {
            if (name === 'WEBGL_debug_renderer_info') {
              return { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 };
            }
            return origGetExt.call(this, name);
          };
        }
      } catch { }

      // Plugins / MIME bloat
      try {
        if (shouldUseSuspiciousDevice) {
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5, 6, 7, 8, 9] });
          Object.defineProperty(navigator, 'mimeTypes', { get: () => [1, 2, 3, 4, 5, 6, 7] });
        }
      } catch { }

      // Connection chaos (only when suspicious)
      try {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (shouldUseSuspiciousDevice && conn) {
          const connectionTypes = ['wifi', 'cellular', 'ethernet', 'bluetooth'];
          Object.defineProperty(conn, 'effectiveType', { get: () => ['slow-2g', '2g', '3g', '4g'][Math.floor(Math.random() * 4)] });
          Object.defineProperty(conn, 'type', { get: () => connectionTypes[Math.floor(Math.random() * connectionTypes.length)] });
        }
      } catch { }

      // Performance jitter
      try {
        const originalNow = performance.now;
        const timeOffset = Math.random() * 1000;
        performance.now = function () {
          return originalNow.call(this) + timeOffset + (Math.random() - 0.5) * 2;
        };
      } catch { }

      // Timezone random only when suspicious
      try {
        if (shouldUseSuspiciousDevice) {
          const suspiciousTimezones = [
            'Pacific/Kiritimati', 'Asia/Kathmandu', 'Antarctica/Troll',
            'Africa/Ouagadougou', 'Indian/Chagos', 'Asia/Pyongyang', 'Pacific/Niue'
          ];
          const randomTimezone = suspiciousTimezones[Math.floor(Math.random() * suspiciousTimezones.length)];
          const origResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
          Intl.DateTimeFormat.prototype.resolvedOptions = function () {
            const o = origResolved.call(this);
            o.timeZone = randomTimezone;
            return o;
          };
        }
      } catch { }

      // Screen spoof
      try {
        Object.defineProperty(screen, 'width', { get: () => shouldUseSuspiciousDevice ? 5000 : 1920 });
        Object.defineProperty(screen, 'height', { get: () => shouldUseSuspiciousDevice ? 3000 : 1080 });
        Object.defineProperty(screen, 'colorDepth', { get: () => shouldUseSuspiciousDevice ? 48 : 24 });
      } catch { }

      // Canvas noise (only when suspicious)
      try {
        if (shouldUseSuspiciousDevice) {
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function () {
            try {
              const ctx = this.getContext('2d');
              if (ctx) {
                const { width, height } = this;
                ctx.save();
                ctx.fillStyle = '#00000001';
                ctx.fillRect((Math.random() * width) | 0, (Math.random() * height) | 0, 1, 1);
                ctx.restore();
              }
            } catch { }
            return originalToDataURL.apply(this, arguments);
          };
        }
      } catch { }

      // Light interaction noise
      try {
        let mouseMoveCount = 0;
        document.addEventListener('mousemove', () => {
          mouseMoveCount++;
          if (mouseMoveCount % 50 === 0) setTimeout(() => { }, Math.random() * 100);
        }, true);
        document.addEventListener('mousedown', () => { }, true);
        document.addEventListener('mouseup', () => { }, true);
        document.addEventListener('keydown', () => { }, true);
        document.addEventListener('keyup', () => { }, true);
        document.addEventListener('focus', () => { }, true);
        document.addEventListener('blur', () => { }, true);
      } catch { }

      // Add key suspicious properties when enabled
      if (shouldUseSuspiciousDevice) {
        try {
          // Make plugins look suspicious (headless browser indicator)
          Object.defineProperty(navigator, 'plugins', {
            get: () => ({ length: 0 })
          });
          
          // Make mimeTypes look suspicious
          Object.defineProperty(navigator, 'mimeTypes', {
            get: () => ({ length: 0 })
          });
          
          // Add suspicious connection properties
          Object.defineProperty(navigator, 'connection', {
            get: () => ({
              effectiveType: '2g',
              downlink: 0.5,
              rtt: 1000
            })
          });
        } catch { }
      }

      // Debug
      if (shouldUseSuspiciousDevice) {
        try { 
          console.log("⚠️ Spoofing suspicious device fingerprint!");
          console.log("🔍 Suspicious properties applied:", {
            webdriver: navigator.webdriver,
            userAgent: navigator.userAgent,
            languages: navigator.languages,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            plugins: navigator.plugins.length,
            mimeTypes: navigator.mimeTypes.length,
            connection: navigator.connection?.effectiveType
          });
        } catch { }
      }
    },
    // ===== Single argument object (NOT multiple positional args) =====
    {
      shouldUseSuspiciousDevice,     // <-- draw this ONCE in Node and pass it in
      userAgent: shouldUseSuspiciousDevice
        ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        : undefined,
      isAppleSilicon,
      fakeHardwareConcurrency,
      fakeDeviceMemory,
      fakeGPU
    }
  );

  try {
    const TEST_DOMAIN = process.env.DOMAIN || 'localhost';
    const TEST_PORT = process.env.TEST_PORT || '3000'; // Use main server port by default
    const htmlPath = `http://${TEST_DOMAIN}:${TEST_PORT}/test`;
    logDebug(`Loading test.html from ${TEST_DOMAIN}:${TEST_PORT}...`);
    // await page.goto(htmlPath, { waitUntil: 'networkidle0' });
    await page.goto(htmlPath, { waitUntil: 'networkidle0' });
    if (includeSuspiciousDevice) {
      await context.setExtraHTTPHeaders({
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'X-Suspicious-Test': '1'
      });
    }

    // ✅ Wait for SDK to be ready
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        function checkSDK() {
          if (typeof _pingOneSignals !== 'undefined' && _pingOneSignals.init) {
            resolve();
          } else {
            setTimeout(checkSDK, 500);
          }
        }
        checkSDK();
      });
    });

    logDebug('Initializing SDK...');
    await page.evaluate(async () => {
      if (typeof initializeSDK === 'function') {
        return await initializeSDK();
      } else {
        throw new Error("SDK Initialization function not found");
      }
    });

    logDebug('SDK Initialization Complete.');

    await page.waitForSelector('#username', { timeout: 60000 });

    // ✅ Add random page interactions before form filling
    await simulatePageExploration(page);

    // ✅ Add human-like focus changes and tab switching simulation
    await simulateHumanFocusBehavior(page);

    const target1 = await moveLikeHuman(page, '#username');
    await page.mouse.click(target1.x, target1.y);

    await sleep(Math.random() * 800 + 500); // More realistic timing

    await typeLikeHuman(page, '#username', username);

    // ✅ Random pause between fields with potential focus loss
    await sleep(Math.random() * 1200 + 800);
    
    // Simulate looking away or checking something else
    if (Math.random() < 0.3) {
      await page.mouse.move(Math.random() * 400 + 100, Math.random() * 300 + 100);
      await sleep(Math.random() * 500 + 300);
    }

    const target2 = await moveLikeHuman(page, '#password');
    await page.mouse.click(target2.x, target2.y);

    await sleep(Math.random() * 600 + 400);

    await typeLikeHuman(page, '#password', '2FederateMore!');

    // ✅ Random pause before submit with potential hesitation
    await sleep(Math.random() * 1500 + 1000);
    
    // Simulate final check or hesitation
    if (Math.random() < 0.4) {
      await page.mouse.move(target2.x + (Math.random() - 0.5) * 20, target2.y + (Math.random() - 0.5) * 20);
      await sleep(Math.random() * 800 + 400);
    }

    const target3 = await moveLikeHuman(page, '#submit');
    await page.mouse.click(target3.x, target3.y);

    logDebug('Simulated interaction complete.');

    // ✅ Fix: Ensure _pingOneSignals.getData() is properly called within the browser context
    const fingerprintData = await page.evaluate(async () => {
      try {
        // Log suspicious device properties for debugging
        if (window.__SUSP) {
          console.log("🔍 Suspicious device fingerprint properties:");
          console.log("webdriver:", navigator.webdriver);
          console.log("userAgent:", navigator.userAgent);
          console.log("hardwareConcurrency:", navigator.hardwareConcurrency);
          console.log("deviceMemory:", navigator.deviceMemory);
          console.log("plugins:", navigator.plugins.length);
          console.log("mimeTypes:", navigator.mimeTypes.length);
          console.log("languages:", navigator.languages);
        }
        
        if (typeof _pingOneSignals !== 'undefined' && _pingOneSignals.getData) {
          const data = await _pingOneSignals.getData();
          console.log("📊 Fingerprint data generated:", data.substring(0, 200) + "...");
          return data;
        } else {
          console.warn("PingOne Signals SDK is not loaded or getData() is undefined.");
          return "{}";
        }
      } catch (error) {
        console.error("Error getting fingerprint data:", error);
        return "{}";
      }
    });

    // console.log('Fingerprint Data:', fingerprintData);

    await browser.close();

    // Update user profile with the correct User-Agent for this browser
    if (userProfile) {
      userProfile.agent = realUserAgent;
    }

    return fingerprintData;
  } catch (err) {
    console.error('❌ Error during Playwright fingerprint generation:', err.message);
    await browser.close();
    throw err;
  }
};

// Function to simulate human-like typing with advanced patterns
const typeLikeHuman = async (page, selector, text) => {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  await element.click();
  await page.keyboard.press('Control+a'); // Select all existing text
  await page.keyboard.press('Delete'); // Clear the field

  // Add initial thinking pause
  await sleep(Math.random() * 300 + 100);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Simulate typos and corrections (8% chance)
    if (Math.random() < 0.08 && i > 0) {
      // Type wrong character
      const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
      await page.keyboard.type(wrongChar, { delay: Math.random() * 50 + 30 });
      await sleep(Math.random() * 200 + 100);
      
      // Realize mistake and backspace
      await page.keyboard.press('Backspace');
      await sleep(Math.random() * 100 + 50);
    }
    
    // Variable typing speed (faster for common chars, slower for special chars)
    let baseDelay = 50;
    if (char.match(/[a-zA-Z0-9]/)) {
      baseDelay = Math.random() * 80 + 40; // 40-120ms for alphanumeric
    } else {
      baseDelay = Math.random() * 120 + 80; // 80-200ms for special chars
    }
    
    // Add occasional micro-pauses
    if (Math.random() < 0.15) {
      baseDelay += Math.random() * 100 + 50;
    }
    
    await page.keyboard.type(char, { delay: baseDelay });
    
    // Occasional longer pauses (thinking, reading)
    if (Math.random() < 0.08) {
      await sleep(Math.random() * 800 + 300);
    }
    
    // Pause between words
    if (char === ' ' && Math.random() < 0.3) {
      await sleep(Math.random() * 200 + 100);
    }
  }
  
  // Final pause after typing
  await sleep(Math.random() * 400 + 200);
};

// ✅ Advanced Human-like Mouse Movement with Bezier Curves
const moveLikeHuman = async (page, selector) => {
  const element = await page.$(selector);
  if (!element) {
    console.error(`❌ Element ${selector} not found. Skipping movement.`);
    return { x: 0, y: 0 };
  }

  const boundingBox = await element.boundingBox();
  if (!boundingBox) {
    console.error(`❌ Element ${selector} has no bounding box. Skipping movement.`);
    return { x: 0, y: 0 };
  }

  const { x, y, width, height } = boundingBox;
  const targetX = x + width / 2 + (Math.random() - 0.5) * width * 0.3;
  const targetY = y + height / 2 + (Math.random() - 0.5) * height * 0.3;

  // Approximate current mouse position as center of viewport (Playwright doesn't expose current position)
  const vp = page.viewportSize();
  const currentPos = {
    x: vp ? vp.width / 2 : 640,
    y: vp ? vp.height / 2 : 400
  };

  // Create bezier curve control points for natural movement
  const controlPoint1 = {
    x: currentPos.x + (Math.random() - 0.5) * 200,
    y: currentPos.y + (Math.random() - 0.5) * 200
  };
  const controlPoint2 = {
    x: targetX + (Math.random() - 0.5) * 100,
    y: targetY + (Math.random() - 0.5) * 100
  };

  // Generate bezier curve points
  const steps = Math.floor(Math.random() * 15) + 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bezierX = Math.pow(1 - t, 3) * currentPos.x +
      3 * Math.pow(1 - t, 2) * t * controlPoint1.x +
      3 * (1 - t) * Math.pow(t, 2) * controlPoint2.x +
      Math.pow(t, 3) * targetX;
    const bezierY = Math.pow(1 - t, 3) * currentPos.y +
      3 * Math.pow(1 - t, 2) * t * controlPoint1.y +
      3 * (1 - t) * Math.pow(t, 2) * controlPoint2.y +
      Math.pow(t, 3) * targetY;

    await page.mouse.move(bezierX, bezierY);
    await sleep(Math.random() * 20 + 10); // Variable speed
  }

  // Add micro-movements and hesitation before clicking
  await sleep(Math.random() * 400 + 200);
  
  // Small adjustments around target (human-like precision)
  for (let i = 0; i < 3; i++) {
    const microX = targetX + (Math.random() - 0.5) * 8;
    const microY = targetY + (Math.random() - 0.5) * 8;
    await page.mouse.move(microX, microY);
    await sleep(Math.random() * 50 + 20);
  }
  
  // Final positioning
  await page.mouse.move(targetX, targetY);
  await sleep(Math.random() * 200 + 100);

  return { x: targetX, y: targetY };
};

// ✅ Simulate realistic page exploration behavior
const simulatePageExploration = async (page) => {
  // Initial page load pause (human reading time)
  await sleep(Math.random() * 1000 + 500);
  
  // Random scrolling with natural patterns
  const scrollSteps = Math.floor(Math.random() * 4) + 2;
  for (let i = 0; i < scrollSteps; i++) {
    // Variable scroll amounts (smaller scrolls more common)
    const scrollAmount = Math.random() < 0.7 ? 
      Math.random() * 100 + 50 : 
      Math.random() * 300 + 150;
    
    await page.evaluate((y) => window.scrollBy(0, y), scrollAmount);
    await sleep(Math.random() * 800 + 400);
    
    // Occasional pause to "read"
    if (Math.random() < 0.3) {
      await sleep(Math.random() * 1200 + 600);
    }
  }

  // Random mouse movements with natural patterns
  const viewport = page.viewportSize();
  if (viewport) {
    const moveSteps = Math.floor(Math.random() * 6) + 3;
    for (let i = 0; i < moveSteps; i++) {
      const x = Math.random() * viewport.width;
      const y = Math.random() * viewport.height;
      
      // Move in natural curves with multiple steps
      const steps = Math.floor(Math.random() * 8) + 3;
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const curveX = x * t + (Math.random() - 0.5) * 50;
        const curveY = y * t + (Math.random() - 0.5) * 50;
        
        await page.mouse.move(curveX, curveY);
        await sleep(Math.random() * 50 + 25);
      }
      
      await sleep(Math.random() * 400 + 200);
    }
  }
  
  // Final pause before form interaction
  await sleep(Math.random() * 600 + 300);
};

// ✅ Simulate human focus behavior and attention patterns
const simulateHumanFocusBehavior = async (page) => {
  // Simulate focus loss and regain (like checking phone, other tabs)
  if (Math.random() < 0.4) {
    // Simulate window blur/focus
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await sleep(Math.random() * 2000 + 1000);
    
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await sleep(Math.random() * 500 + 300);
  }
  
  // Simulate mouse leaving and returning to window
  if (Math.random() < 0.3) {
    await page.mouse.move(-100, -100); // Move off screen
    await sleep(Math.random() * 1500 + 800);
    
    const viewport = page.viewportSize();
    if (viewport) {
      await page.mouse.move(Math.random() * viewport.width, Math.random() * viewport.height);
    }
    await sleep(Math.random() * 400 + 200);
  }
  
  // Simulate reading behavior (small scrolls, pauses)
  if (Math.random() < 0.5) {
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, Math.random() * 50 + 25));
      await sleep(Math.random() * 800 + 400);
    }
  }
};

// Random viewport resize (simulate window resizing)
const simulateWindowResize = async (page) => {
  if (Math.random() < 0.3) {
    const newWidth = Math.floor(Math.random() * 200) + 1200;
    const newHeight = Math.floor(Math.random() * 200) + 800;
    await page.setViewportSize({ width: newWidth, height: newHeight });
    await sleep(Math.random() * 1000 + 500);
  }
};

// Helper function for random delays
const randomDelay = () => Math.floor(Math.random() * 150) + 50;

// ✅ Custom sleep function to replace waitForTimeout
const sleep = async (ms) => {
  await new Promise(resolve => setTimeout(resolve, ms));
};

// Helper function for random typing delay
// const randomDelay = () => Math.floor(Math.random() * 100) + 50;

const main = async () => {
  try {
    const token = await getToken();
    const numberToLoad = parseInt(process.env.NUMBER_OF_TOTAL_RUNS, 10) || 10; // ✅ Enforce NUMBER_OF_RUNS
    const concurrentLimit = parseInt(process.env.NUMBER_OF_CONCURRENT_RUNS, 10) || 20; // ✅ Concurrency limit
    const includeSDK = process.env.INCLUDE_SDK === 'true';
    const badActors = process.env.INCLUDE_BADACTORS === 'true';
    const processSequentially = process.env.PROCESS_USERS_SEQUENTIALLY === 'true'; // ✅ New control variable
    const evaluationLevelStats = { LOW: 0, MEDIUM: 0, HIGH: 0, UNKNOWN: 0, ERROR: 0 };

    // ✅ Determine which user set to use
    const userSource = process.env.USER_SOURCE === 'external' ? 'external_Users' : 'internal_Users';
    const userFilePath = path.join(__dirname, `../data/${userSource}`);

    // ✅ Fetch usernames from the selected file
    const users = await fs.readFile(userFilePath, 'utf-8')
      .then(content => content.split('\n').filter(line => line.trim() !== ''));

    let selectedUsernames;
    if (processSequentially) {
      // ✅ Sequential: cycle through users in order, looping back when we reach the end
      selectedUsernames = Array.from({ length: numberToLoad }, (_, index) => 
        users[index % users.length]
      );
      console.log(`🔹 Processing ${userSource} **sequentially** with cycling (${users.length} total users).`);
      console.log(`📋 Selected users: ${selectedUsernames.slice(0, 5).join(', ')}${selectedUsernames.length > 5 ? '...' : ''}`);
    } else {
      selectedUsernames = Array.from({ length: numberToLoad }, () =>
        users[Math.floor(Math.random() * users.length)]
      );
      console.log(`🎲 Processing ${userSource} in **randomized order**.`);
      console.log(`📋 Selected users: ${selectedUsernames.slice(0, 5).join(', ')}${selectedUsernames.length > 5 ? '...' : ''}`);
    }

    // ✅ Get or create user profiles
    const userProfiles = await getOrCreateUserProfiles(selectedUsernames);

    // ✅ Function to process a single transaction
    const processTransaction = async (username) => {
      try {
        const userProfile = userProfiles[username];

        // ✅ Apply temporary bad IP override for event only
        let eventIp = userProfile.ip;
        if (badActors && Math.random() < 0.02) { // 02% chance
          const badIps = await fs.readFile(path.join(__dirname, '../data/ips_Bad'), 'utf-8')
            .then(content => content.split('\n').filter(line => line.trim() !== ''));
          eventIp = badIps[Math.floor(Math.random() * badIps.length)];
          console.log(`⚠️ Using temporary bad IP for event: ${eventIp}`);
        }

        // ✅ Ensure fingerprint uses the correct User-Agent
        let fingerprintData = null;
        if (includeSDK) {
          fingerprintData = await generateFingerprint(username, userProfile);
        }

        // Determine risk level based on FORCED_RISK_LEVEL
        let riskLevel = process.env.FORCED_RISK_LEVEL;

        // ✅ If FORCED_RISK_LEVEL is true, generate a new risk level per request
        const getRiskLevelForRequest = () => {
          if (process.env.FORCED_RISK_LEVEL === 'true') {
            const riskLevels = ['LOW', 'MEDIUM', 'HIGH'];
            const selectedRisk = riskLevels[Math.floor(Math.random() * riskLevels.length)];
            // console.log(`🔍 Selected Risk Level: ${selectedRisk}`); // ✅ Debugging output
            return selectedRisk;
          }
          return riskLevel; // ✅ Uses the fixed value if set to LOW, MEDIUM, or HIGH
        };

        const replacements = {
          IP: eventIp,
          NAME: userProfile.name,
          MAIL: userProfile.email,
          AGENT: userProfile.agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
          FORCED_RISK_LEVEL: getRiskLevelForRequest(),
          FINGERPRINT: fingerprintData || '',
          USER_ID: username,
          DEVICE_ID: userProfile.deviceID,
          RISK_POLICY_ID: process.env.RISK_POLICY_ID,
          CLIENT_ID: process.env.CLIENT_ID,
        };

        logDebug('Replacements:', replacements);

        const requestData = await loadRequestData(path.join(__dirname, '../data/sdkRequestData.json'), replacements);

        // ✅ Handle dynamic user object for internal vs external users
        const userSourceType = process.env.USER_SOURCE === 'external' ? 'external' : 'internal';

        if (userSourceType === 'external') {
          requestData.event.user = {
            id: userProfile.email,
            name: userProfile.email,
            type: 'EXTERNAL'
          };
        } else {
          requestData.event.user = {
            name: username,
            type: 'PING_ONE'
          };
        }

        // ✅ Ensure requestData is a string before applying `.replace()`
        if (riskLevel === "false") {
          delete requestData.event.inducerisk; // ✅ Removes the field if requestData is an object
          // console.log("requestData", requestData)
        }

        const { id: riskEvalID, level: returnedRiskLevel, createdAt } = await sendRequest(token, requestData);
        if (evaluationLevelStats.hasOwnProperty(returnedRiskLevel)) {
          evaluationLevelStats[returnedRiskLevel]++;
        } else {
          evaluationLevelStats.UNKNOWN++;
        }

        if (!riskEvalID) {
          console.error(`❌ Risk Evaluation POST failed for ${username}. Skipping PUT request.`);
          return;
        }

        await updateRiskEvaluation(token, riskEvalID);

        // Send feedback after successful PUT (optional)
        if (createdAt) {
          try {
            await sendRiskEvaluationFeedback(token, riskEvalID, createdAt);
            console.log(`📝 Feedback sent for Risk EvalId: ${riskEvalID}`);
          } catch (feedbackError) {
            console.log(`⚠️  Feedback failed for Risk EvalId: ${riskEvalID} - continuing without feedback`);
          }
        }

        console.log(`✅ Processed user: ${username} - Risk EvalId: ${riskEvalID}`);
      } catch (err) {
        console.error(`❌ Error processing ${username}:`, err.message);
      }
    };

    // ✅ Function to process users with proper sequential/parallel logic
    const runInBatches = async (usernames, limit) => {
      if (processSequentially) {
        // Sequential batching: process users in batches in order (user.0-9, user.10-19, etc.)
        console.log(`🔹 Processing ${usernames.length} users **sequentially in batches of ${limit}**`);
        for (let i = 0; i < usernames.length; i += limit) {
          const batch = usernames.slice(i, i + limit);
          const batchNumber = Math.floor(i / limit) + 1;
          const totalBatches = Math.ceil(usernames.length / limit);
          
          // Show cycling info if we're past the first cycle
          const cycleInfo = i >= users.length ? ` (cycle ${Math.floor(i / users.length) + 1})` : '';
          console.log(`🚀 Sequential batch ${batchNumber}/${totalBatches}: users ${i + 1}-${Math.min(i + limit, usernames.length)}${cycleInfo} (${batch.join(', ')})`);

          // ✅ Run this batch concurrently
          await Promise.allSettled(batch.map(processTransaction));
        }
      } else {
        // Parallel processing: use batches with concurrency limit
        for (let i = 0; i < usernames.length; i += limit) {
          const batch = usernames.slice(i, i + limit);
          console.log(`🚀 Running batch: ${i + 1} - ${Math.min(i + limit, usernames.length)}`);

          // ✅ Run this batch concurrently
          await Promise.allSettled(batch.map(processTransaction));
        }
      }
    };

    // ✅ Run with proper sequential/parallel logic
    await runInBatches(selectedUsernames, concurrentLimit);

    console.log('\n📊 Evaluation Result Summary (from PingOne responses):');
    console.table(evaluationLevelStats);

    console.log('✅ All requests processed in parallel.');
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
  }
};

main();
