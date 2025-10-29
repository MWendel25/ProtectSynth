# ProtectSynth

## Overview
ProtectSynth is a tool designed to assist with sending sample data into the PingOne Protect console. It is intended for demonstration and learning around the **Threat Protection** dashboard, policy tuning, and realistic sample data generation.

This tool utilizes the files under the `data/` directory to create and maintain user profiles in `user_profiles.json`. Upon a user's first interaction, a profile is generated containing details such as:
- **Username**
- **First Name & Last Name**
- **Email**
- **User Agent** (browser details)
- **Device ID**
- **IP Address**
- **Operating System** (Windows, macOS, Linux)

Once created, this profile is used for all subsequent requests, ensuring that the user appears to come from the same device and location—helping to build a consistent model for evaluation.

### How It Works
This script will open a browser to generate **signals data** for each user evaluation based on their profile, making the user appear as realistic as possible. You can then manually sign in from your local machine or another device to simulate a differing attempt for the same user.

Additionally, the script provides options to introduce **randomized behavior** using environment variables:
- **`INCLUDE_BADACTORS`**: At a 2% interval, assigns a bad IP address to the user. *(This interval can be adjusted at **line 1009** in `sendData.js`.)*
- **`INCLUDE_SUSPICIOUS_DEVICE`**: When enabled, alters browser fingerprints to generate a suspicious device profile with various detection-evasion techniques.
- **`INCLUDE_SDK`**: If set to `false`, the script will send data **without** generating browser signals, allowing for direct data injection without behavioral tracking.
- **`FORCED_RISK_LEVEL`**: Controls risk levels assigned to users. When set to `LOW`, `MEDIUM`, or `HIGH`, it forces that risk level. If set to `"true"`, a random risk level is assigned per request. If `"false"`, the `inducerisk` field is removed. *(This logic is handled dynamically in `sendData.js`.)*
- **`PROCESS_USERS_SEQUENTIALLY`**: When enabled, processes users in sequential order rather than randomly, cycling through the user list.

### Advanced Features

**Human-like Behavior Simulation:**
- **Realistic Typing Patterns**: Variable typing speeds, typos, corrections, and natural pauses
- **Mouse Movement**: Bezier curve-based mouse movements with micro-adjustments
- **Page Exploration**: Random scrolling, focus changes, and attention patterns
- **Browser Fingerprinting**: Dynamic User-Agent generation per browser type and OS
- **OS Assignment**: Random operating system assignment (Windows, macOS, Linux) per user profile

**Suspicious Device Detection Evasion:**
- **Hardware Spoofing**: Modified CPU cores, memory, and GPU information
- **WebGL Fingerprinting**: Customized WebGL vendor and renderer information
- **Connection Properties**: Altered network connection characteristics
- **Plugin and MIME Type Manipulation**: Modified browser plugin signatures
- **Performance Timing**: Randomized performance.now() values
- **Screen Properties**: Customized screen dimensions and color depth

**Multi-Browser Support:**
- **Random Browser Assignment**: Each user is randomly assigned a browser from: Chromium, Firefox, WebKit, Chrome
- **Chromium/Chrome**: Full feature support with advanced flags
- **Firefox**: Complete compatibility with Gecko engine
- **WebKit/Safari**: Safari browser simulation
- **Edge**: Microsoft Edge channel support (via fallback environment variable)

## Limitations
- ⚠ **Bot Detection Limitation**: This logic does **not** fool the **Bot Detected Predictor**. When utilizing this tool, it is recommended to leave this predictor **off** your policy.
- ⚠ **Browser Dependencies**: Requires Playwright browsers to be installed. Use `npm run setup-browsers` to install them.
- ⚠ **Concurrency Limits**: Recommended concurrent runs are between 20-40. Higher values may cause timeouts.

ProtectSynth is built using **Node.js** with **Playwright** for browser automation and **Express** for local server functionality, supporting various integrations for efficient data processing.

## Installation
To install dependencies, run:
```sh
npm install
```

To install Playwright browsers and dependencies:
```sh
npm run setup-browsers
```

To install specific browser channels (Chrome, Edge):
```sh
npm run install-channels
```

## Usage

### Running the Local Server
To run the project with a local server (recommended for testing), use:
```sh
npm run server
# or
npm run dev
```

This will start a local server at `http://localhost:3000` where you can access your test pages with a proper domain instead of using the file system.

**Access Points:**
- **Data Generator**: Uses `http://localhost:3000` (reliable for automation)
- **Manual Testing**: `http://protect.test.com:3000` (custom domain for realistic testing)
- **Direct Access**: `http://localhost:3000` (main server)
- **Health Check**: `http://localhost:3000/health` (server status)

**Server Features:**
- **Static File Serving**: Serves all project files from the root directory
- **Test Page**: Provides a dedicated test page at `/test` for SDK integration
- **Health Monitoring**: Built-in health check endpoint for server status
- **Custom Domain Support**: Configurable domain mapping for realistic testing

**Environment Variables:**
- `DOMAIN`: Custom domain name (default: `localhost`)
- `PORT`: Server port (default: `3000`)
- `HOST`: Server host (default: `0.0.0.0`)

### Running the Data Generator
To start the main data generation application, use:
```sh
npm start
```

This will automatically:
1. Check if the server is running
2. Start the server if it's not running
3. Run the data generator

Or, if applicable, run specific scripts:
```sh
npm run data
# or
node scripts/sendData.js
```

### Additional Scripts
- `npm run setup-browsers` - Install Playwright browsers and dependencies
- `npm run install-channels` - Install specific browser channels (Chrome, Edge)
### Setting Up PingOne Worker Application
To integrate ProtectSynth with PingOne, follow these steps to create a **Worker Application** and configure it correctly:

1. **Log in to PingOne** and navigate to **Applications**.
2. Click **+ Add Application** and select **Worker Application**.
3. Provide a name and description for your application.
4. Under **Credentials**, set the **Token Endpoint Authentication Method** to `client_secret_basic`.
5. Add the following roles to the worker app:   Application Owner (your P1 ENV), Identity Data Admin (your P1 ENV)
6. Save the application and copy the **Client ID** and **Client Secret** for later use.
7. Ensure your application has the necessary permissions to access APIs.

## Setting Up FORCED_RISK_LEVEL
To properly configure and use the `FORCED_RISK_LEVEL` variable in ProtectSynth, follow these steps:

1. **Log in to PingOne** and navigate to **Predictors** under **Threat Protect**.
2. Click **+ Predictors** and select **Custom**.
3. Provide a readable **Display Name** and **Compact Name**.
4. For **Attribute Mapping**, provide the following details: `${event.inducerisk}`.
5. Set the **Risk Level Mapping** to a List Item and configure:
   - Set `LOW` to the **Low** score.
   - Set `MEDIUM` to the **Medium** score.
   - Set `HIGH` to the **High** score.
6. Save the Predictor.
7. Navigate to **Risk Policies**.
8. In the policy you are utilizing, select **+ ADD Rule** under **Override** at the bottom.
9. Provide three rules:
   - If **Induce Risk Score** is `HIGH`, then **Return HIGH**.
   - If **Induce Risk Score** is `LOW`, then **Return LOW**.
   - If **Induce Risk Score** is `MEDIUM`, then **Return MEDIUM**.

## Configuration
Ensure you have the necessary environment variables configured in a `.env` file:

| Variable | Description | Example Value |
|----------|------------|--------------|
| `ENVID` | The PingOne environment ID with PingOne. | `"12345678-123A-1234-5678-1ab2c3def4567"` |
| `CLIENT_ID` | The client ID for the PingOne Worker Application. | `"abcdefg1-a123-12b3-ab1c-12345ab6c7d8"` |
| `CLIENT_SECRET` | The client secret for the PingOne Worker Application. | `"A123bCD_Efgh45ij6_KL7M~no8-Pq9S0T12UVwX3Yz4aBCD5efG-HiJkLMNOPQR6"` |
| `RISK_POLICY_ID` | The ID of the risk policy being applied. | `"1ab23c4d-e5ff-678g-901h-ij2kl34567m"` |
| `INCLUDE_BADACTORS` | Whether to include simulated bad actors in the dataset. When true this sends in a bad IP address 20% of the time. | `true` / `false` |
| `INCLUDE_SUSPICIOUS_DEVICE` | Whether to include simulated suspicious devices in the dataset. When true this sends in a suspicious devices 20% of the time. | `true` / `false` |
| `NUMBER_OF_CONCURRENT_RUNS` | Number of concurrent processes running at a time. Recommendation is between 0 and 40, moving to 50 starts to get some timeouts on a standard machine. | `20` (Recommended: 20 - 40) |
| `NUMBER_OF_TOTAL_RUNS` | Total number of runs to be executed. | `1000` |
| `DEBUG` | Enables debugging mode for logging additional information, such as the POST and PUT information from each Protect call. | `true` / `false` |
| `INCLUDE_SDK` | Determines if the SDK should be included in requests. If false, all the information will be sent simply without the signals generated. | `true` / `false` |
| `USER_SOURCE` | Determines the user file and structure used. Accepts `internal` or `external`. When set to `external`, it reads from `external_Users` and sends user type `EXTERNAL`; otherwise, it defaults to internal users and uses type `PING_ONE`. | `internal` / `external` |
| `PROCESS_USERS_SEQUENTIALLY` | If `true`, processes users sequentially rather than randomly, ensuring each user is used for the specified number of runs. | `true` / `false` |
| `FORCED_RISK_LEVEL` | Controls risk levels assigned to users. Acceptable values: `LOW`, `MEDIUM`, `HIGH`, or `"true"` for random per request. If `"false"`, `inducerisk` is removed from the request. | `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"true"`, `"false"` |
| `DOMAIN` | Custom domain for testing (used with host-resolver-rules). | `localhost` |
| `TEST_PORT` | Port for the test server (default: `3000`). | `3000` |

Here is an example of an .env file
```
ENVID="yourEnvID"
CLIENT_ID="yourClientID"
CLIENT_SECRET="yourClientSecret"
RISK_POLICY_ID="yourRiskPolicyId"
INCLUDE_BADACTORS=boolean
INCLUDE_SUSPICIOUS_DEVICE=boolean
NUMBER_OF_CONCURRENT_RUNS=INT #Recommended around 20 - 40
NUMBER_OF_TOTAL_RUNS=INT
DEBUG=boolean
INCLUDE_SDK=boolean
USER_SOURCE=internal | external
PROCESS_USERS_SEQUENTIALLY=boolean
FORCED_RISK_LEVEL=LOW | MEDIUM | HIGH | true | false
DOMAIN=localhost
TEST_PORT=3000
```

  ### **Tracking User Profiles in Requests**
The `user_profile.json` file is used to track user and device data across iterations of a run. When a user first interacts with the system, a profile is created containing their **device ID** and **browser information**. This profile is then leveraged in subsequent requests to ensure the user appears consistent across different interactions. If you would like to reset or update the user, update this profile or delete the users profile, and a new item will be created.

## Project Structure
```
ProtectSynth/
├── data/                    # Contains datasets and configuration files
│   ├── external_Users       # External user list
│   ├── internal_Users       # Internal user list
│   ├── ips_*               # Various IP address pools (Amazon, Apple, Cloudflare, etc.)
│   ├── mail_Domains        # Email domain list
│   ├── names               # Name list for user generation
│   ├── requestData.json    # Legacy request template
│   ├── sdkRequestData.json # SDK-enabled request template
│   └── user_profiles.json  # Generated user profiles
├── scripts/
│   └── sendData.js         # Main data generation script
├── server.js               # Express server for local testing
├── start.js                # Application entry point
├── test.html               # Test page for SDK integration
├── launch.json             # VS Code debug configuration
├── package.json            # Node.js package configuration
└── README.md               # Project documentation
```

## Contributing
Feel free to submit issues or pull requests if you'd like to contribute.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
