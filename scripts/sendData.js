require('dotenv').config();
const axios = require('axios');
const base64 = require('base-64');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer-extra');
const { createCursor } = require('ghost-cursor');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin()); // ✅ Use Puppeteer stealth plugin to avoid bot detection

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
  let realUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"; // Default UA

  // ✅ Load existing user profiles if the file exists
  try {
    const data = await fs.readFile(USER_PROFILES_PATH, 'utf-8');
    userProfiles = JSON.parse(data);
  } catch (error) {
    console.log("User profile file not found, creating new.");
  }

  // ✅ Launch a single browser instance to get the real User-Agent *ONLY IF includeSDK is true*
  if (includeSDK) {
    console.log("🔹 Launching Chrome to get real User-Agent...");
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });
    const page = await browser.newPage();
    realUserAgent = await page.evaluate(() => navigator.userAgent); // ✅ Get actual Chrome version
    await browser.close();
    console.log(`✅ Retrieved real User-Agent: ${realUserAgent}`);
  } else {
    console.log("🚀 SDK is disabled. Using default User-Agent:", realUserAgent);
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
      // ✅ If user exists, check if User-Agent needs updating
      if (userProfiles[username].agent !== realUserAgent) {
        console.log(`🔹 Updating User-Agent for ${username}`);
        userProfiles[username].agent = realUserAgent;
        updated = true;
      }

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

      userProfiles[username] = {
        user: username,
        name: name,
        email: email,
        ip: ip,
        agent: realUserAgent,
        deviceID: generateDeviceID()
      };
      updated = true;
      console.log(`✅ New user profile created: ${username}`);
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

    // Extract and return the RiskEvalID
    return {
      id: response.data?.id || null,
      level: response.data?.result?.level || 'UNKNOWN'
    };
  } catch (error) {
    console.error(
      'Error sending the request:',
      error.response ? error.response.data : error.message
    );
    return { id: null, level: 'ERROR' };
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

const generateFingerprint = async (username) => {
  const isDebug = process.env.DEBUG === 'true';
  const includeSuspiciousDevice = process.env.INCLUDE_SUSPICIOUS_DEVICE === 'true';
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; // MacOS

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800',
      // isDebug ? '--start-maximized' : '--window-position=9999,9999',
      isDebug ? '--start-maximized' : '',
    ],
    defaultViewport: isDebug ? null : { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  const realUserAgent = await page.evaluate(() => navigator.userAgent);
  await page.setUserAgent(realUserAgent);

  // ✅ Detect M1/M2/M3 (ARM) vs Intel Mac
  const isAppleSilicon = process.arch === 'arm64'; // Check if running on M1/M2/M3

  // ✅ Generate random suspicious device properties if enabled
  const fakeHardwareConcurrency = includeSuspiciousDevice ? Math.random() > 0.5 ? 32 : 64 : 8;
  const fakeDeviceMemory = includeSuspiciousDevice ? Math.random() > 0.5 ? 128 : 256 : 8;
  const fakeGPU = includeSuspiciousDevice ? (Math.random() > 0.5 ? 'NVIDIA GeForce RTX 4090' : 'AMD Radeon RX 7900 XTX') : 'Apple M1';

  await page.evaluateOnNewDocument((userAgent, isAppleSilicon, fakeHardwareConcurrency, fakeDeviceMemory, fakeGPU, includeSuspiciousDevice) => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

    // ✅ Ensure userAgent and userAgentData are overridden
    Object.defineProperty(navigator, 'userAgent', { get: () => userAgent });
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => ({
        brands: [{ brand: "Google Chrome", version: "120" }, { brand: "Chromium", version: "120" }, { brand: "Not A;Brand", version: "99" }],
        mobile: false,
        platform: "MacOS"
      })
    });

    // 🎲 20% Chance to Trigger a Suspicious Device
    const shouldUseSuspiciousDevice = includeSuspiciousDevice && Math.random() < 0.2; // 20% probability

    // ✅ Spoof navigator.platform dynamically
    const suspiciousPlatforms = ["Linux", "Win32"];
    const fakePlatform = shouldUseSuspiciousDevice
      ? suspiciousPlatforms[Math.floor(Math.random() * suspiciousPlatforms.length)]
      : (isAppleSilicon ? "Mac" : "MacIntel");

    Object.defineProperty(navigator, 'platform', { get: () => fakePlatform });

    // ✅ Modify existing fakeHardwareConcurrency instead of redeclaring it
    if (shouldUseSuspiciousDevice) {
      fakeHardwareConcurrency = Math.random() > 0.5 ? 32 : 64; // 🎲 50% 32 cores, 50% 64 cores
      fakeDeviceMemory = Math.random() > 0.5 ? 128 : 256; // 🎲 50% 128GB, 50% 256GB
    }

    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fakeHardwareConcurrency });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => fakeDeviceMemory });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Apple' });

    // ✅ Spoof WebGL Vendor/Renderer
    if (shouldUseSuspiciousDevice) {
      fakeGPU = Math.random() > 0.5 ? 'NVIDIA GeForce RTX 4090' : 'AMD Radeon RX 7900 XTX';
    }

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) return 'Apple Inc.';
      if (parameter === 37446) return fakeGPU;
      return getParameter(parameter);
    };

    // ✅ Spoof WebGL Unmasked Vendor/Renderer
    const debugInfo = WebGLRenderingContext.prototype.getExtension;
    WebGLRenderingContext.prototype.getExtension = function (name) {
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_VENDOR_WEBGL: 37445,
          UNMASKED_RENDERER_WEBGL: 37446
        };
      }
      return debugInfo(name);
    };

    // ✅ Block WebRTC Leaks
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 1 });
    Object.defineProperty(navigator, 'plugins', { get: () => shouldUseSuspiciousDevice ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'mimeTypes', { get: () => shouldUseSuspiciousDevice ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3] });

    // ✅ Block WebRTC leaking real IPs
    Object.defineProperty(navigator, 'mediaDevices', {
      get: () => ({
        enumerateDevices: async () => shouldUseSuspiciousDevice
          ? [
            { kind: 'videoinput', label: 'Suspicious Webcam 9000', deviceId: 'fake-webcam' },
            { kind: 'audioinput', label: 'Suspicious Microphone', deviceId: 'fake-mic' },
            { kind: 'audiooutput', label: 'Suspicious Speaker', deviceId: 'fake-speaker' }
          ]
          : []
      })
    });

    // ✅ Spoof Timezone with Random Selection (Only for suspicious devices)
    if (shouldUseSuspiciousDevice) {
      const suspiciousTimezones = [
        'Pacific/Kiritimati',
        'Asia/Kathmandu',
        'Antarctica/Troll',
        'Africa/Ouagadougou',
        'Indian/Chagos',
        'Asia/Pyongyang',
        'Pacific/Niue'
      ];
      const randomTimezone = suspiciousTimezones[Math.floor(Math.random() * suspiciousTimezones.length)];
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
        get: () => () => ({ timeZone: randomTimezone })
      });
    }

    // ✅ Spoof screen properties
    Object.defineProperty(screen, 'width', { get: () => shouldUseSuspiciousDevice ? 5000 : 1920 });
    Object.defineProperty(screen, 'height', { get: () => shouldUseSuspiciousDevice ? 3000 : 1080 });
    Object.defineProperty(screen, 'colorDepth', { get: () => shouldUseSuspiciousDevice ? 48 : 24 });

    // ✅ Simulate real user interactions
    document.addEventListener('mousemove', () => { }, true);
    document.addEventListener('mousedown', () => { }, true);
    document.addEventListener('mouseup', () => { }, true);
    document.addEventListener('keydown', () => { }, true);
    document.addEventListener('keyup', () => { }, true);

    // 🔥 Debugging: Log when suspicious device mode is triggered
    if (shouldUseSuspiciousDevice) {
      console.log("⚠️ Spoofing suspicious device fingerprint!");
    }

  }, realUserAgent, isAppleSilicon, fakeHardwareConcurrency, fakeDeviceMemory, fakeGPU, includeSuspiciousDevice);

  try {
    const TEST_DOMAIN = process.env.TEST_DOMAIN || 'localhost';
    const TEST_PORT = process.env.TEST_PORT || '3000'; // Use main server port by default
    const htmlPath = `http://${TEST_DOMAIN}:${TEST_PORT}/test`;
    logDebug(`Loading test.html from ${TEST_DOMAIN}:${TEST_PORT}...`);
    await page.goto(htmlPath, { waitUntil: 'networkidle0' });

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

    const cursor = createCursor(page);
    await cursor.move('#username');
    await cursor.click();

    await sleep(1000); // ✅ Replaced waitForTimeout

    await typeLikeHuman(page, '#username', username);

    await cursor.move('#password');
    await cursor.click();

    await sleep(1000); // ✅ Replaced waitForTimeout

    await typeLikeHuman(page, '#password', '2FederateMore!');

    await cursor.move('#submit');
    await cursor.click();

    logDebug('Simulated interaction complete.');

    // ✅ Fix: Ensure _pingOneSignals.getData() is properly called within the browser context
    const fingerprintData = await page.evaluate(async () => {
      if (typeof _pingOneSignals !== 'undefined' && _pingOneSignals.getData) {
        return await _pingOneSignals.getData();
      } else {
        throw new Error("PingOne Signals SDK is not loaded or getData() is undefined.");
      }
    });

    // console.log('Fingerprint Data:', fingerprintData);

    await browser.close();
    return fingerprintData;
  } catch (err) {
    console.error('❌ Error during Puppeteer fingerprint generation:', err.message);
    await browser.close();
    throw err;
  }
};

// Function to simulate human-like typing
const typeLikeHuman = async (page, selector, text) => {
  const chars = text.split('');
  for (let i = 0; i < chars.length; i++) {
    await page.type(selector, chars[i], { delay: randomDelay() });
    if (Math.random() > 0.8 && i > 0) {
      await page.keyboard.press('Backspace');
      await sleep(randomDelay()); // ✅ Replaced waitForTimeout
      await page.type(selector, chars[i], { delay: randomDelay() });
    }
  }
};

// ✅ Simulate Randomized Cursor Movement Not used currently
const moveLikeHuman = async (page, cursor, selector) => {
  const element = await page.$(selector);
  if (!element) {
    console.error(`❌ Element ${selector} not found. Skipping movement.`);
    return;
  }

  const boundingBox = await element.boundingBox();
  if (!boundingBox) {
    console.error(`❌ Element ${selector} has no bounding box. Skipping movement.`);
    return;
  }

  const { x, y, width, height } = boundingBox;
  const moveX = x + width / 3 + Math.random() * width / 3;
  const moveY = y + height / 3 + Math.random() * height / 3;

  await cursor.move({ x: moveX, y: moveY }, { steps: Math.floor(Math.random() * 10) + 5 });
  await sleep(Math.random() * 500 + 200);
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
      selectedUsernames = users.slice(0, numberToLoad);
      console.log(`🔹 Processing ${userSource} **sequentially** from front to back.`);
    } else {
      selectedUsernames = Array.from({ length: numberToLoad }, () =>
        users[Math.floor(Math.random() * users.length)]
      );
      console.log(`🎲 Processing ${userSource} in **randomized order**.`);
    }

    // ✅ Get or create user profiles
    const userProfiles = await getOrCreateUserProfiles(selectedUsernames);

    // ✅ Function to process a single transaction
    const processTransaction = async (username) => {
      try {
        const userProfile = userProfiles[username];

        // ✅ Apply temporary bad IP override for event only
        let eventIp = userProfile.ip;
        if (badActors && Math.random() < 0.2) { // 20% chance
          const badIps = await fs.readFile(path.join(__dirname, '../data/ips_Bad'), 'utf-8')
            .then(content => content.split('\n').filter(line => line.trim() !== ''));
          eventIp = badIps[Math.floor(Math.random() * badIps.length)];
          console.log(`⚠️ Using temporary bad IP for event: ${eventIp}`);
        }

        // ✅ Ensure fingerprint uses the correct User-Agent
        let fingerprintData = null;
        if (includeSDK) {
          fingerprintData = await generateFingerprint(username);
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
          AGENT: userProfile.agent,
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

        const { id: riskEvalID, level: returnedRiskLevel } = await sendRequest(token, requestData);
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
        console.log(`✅ Processed user: ${username} - Risk EvalId: ${riskEvalID}`);
      } catch (err) {
        console.error(`❌ Error processing ${username}:`, err.message);
      }
    };

    // ✅ Function to process in parallel with concurrency limit
    const runInBatches = async (usernames, limit) => {
      for (let i = 0; i < usernames.length; i += limit) {
        const batch = usernames.slice(i, i + limit); // ✅ Take `limit` users at a time
        console.log(`🚀 Running batch: ${i + 1} - ${Math.min(i + limit, usernames.length)}`);

        // ✅ Run this batch concurrently
        await Promise.allSettled(batch.map(processTransaction));
      }
    };

    // ✅ Run in parallel batches
    await runInBatches(selectedUsernames, concurrentLimit);

    console.log('\n📊 Evaluation Result Summary (from PingOne responses):');
    console.table(evaluationLevelStats);

    console.log('✅ All requests processed in parallel.');
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
  }
};

main();
