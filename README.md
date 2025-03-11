# ProtectSynth

## Overview
ProtectSynth is a tool designed to assist with sending sample data into the PingOne Protect console. It is intended for demonstration and learning around the **Threat Protection** dashboard, policy tuning, and realistic sample data generation.

This tool utilizes the files under the `data/` directory to create and maintain user profiles in `user_profiles.json`. Upon a user’s first interaction, a profile is generated containing details such as:
- **Username**
- **First Name & Last Name**
- **Email**
- **User Agent** (browser details)
- **Device ID**
- **IP Address**

Once created, this profile is used for all subsequent requests, ensuring that the user appears to come from the same device and location—helping to build a consistent model for evaluation.

### How It Works
This script will open a browser to generate **signals data** for each user evaluation based on their profile, making the user appear as realistic as possible. You can then manually sign in from your local machine or another device to simulate a differing attempt for the same user.

Additionally, the script provides options to introduce **randomized behavior** using environment variables:
- **`INCLUDE_BADACTORS`**: At a 20% interval, assigns a bad IP address to the user. *(This interval can be adjusted at **line 533** in `sendData.js`.)*
- **`INCLUDE_SUSPICIOUS_DEVICE`**: At a 20% interval, alters browser fingerprints to generate a suspicious device profile. *(This interval can be adjusted at **line 278** in `sendData.js`.)*
- **`INCLUDE_SDK`**: If set to `false`, the script will send data **without** generating browser signals, allowing for direct data injection without behavioral tracking.
- **`FORCED_RISK_LEVEL`**: Controls risk levels assigned to users. When set to `LOW`, `MEDIUM`, or `HIGH`, it forces that risk level. If set to `"true"`, a random risk level is assigned per request. If `"false"`, the `inducerisk` field is removed. *(This logic is handled dynamically in `sendData.js`.)*

## Limitations
- ⚠ **Bot Detection Limitation**: This logic does **not** fool the **Bot Detected Predictor**. When utilizing this tool, it is recommended to leave this predictor **off** your policy.

ProtectSynth is built using **Node.js** and supports various integrations for efficient data processing.

## Installation
To install dependencies, run:
```sh
npm install
```

## Usage
To start the application, use:
```sh
npm start
```

Or, if applicable, run specific scripts:
```sh
node sendData.js
```
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
| `NUMBER_OF_TOTAL_RUNS` | Total number of runs to be executed. | `1000` |
| `NUMBER_OF_CONCURRENT_RUNS` | Number of concurrent processes running at a time. Recommendation is between 0 and 40, moving to 50 starts to get some timeouts on a standard machine. | `20` (Recommended: 20 - 40) |
| `DEBUG` | Enables debugging mode for logging additional information, such as the POST and PUT information from each Protect call. | `true` / `false` |
| `INCLUDE_SDK` | Determines if the SDK should be included in requests. If false, all the information will be sent simply without the signals generated. | `true` / `false` |
| `PROCESS_USERS_SEQUENTIALLY` | If `true`, processes users sequentially rather than randomly, ensuring each user is used for the specified number of runs. | `true` / `false` |
| `FORCED_RISK_LEVEL` | Controls risk levels assigned to users. Acceptable values: `LOW`, `MEDIUM`, `HIGH`, or `"true"` for random per request. If `"false"`, `inducerisk` is removed from the request. | `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"true"`, `"false"` |

Here is an example of an .env file
```
ENVID="yourEnvID"
CLIENT_ID="yourClientID"
CLIENT_SECRET="yourClientSecret"
RISK_POLICY_ID="yourRiskPolicyId"
INCLUDE_BADACTORS=boolean
INCLUDE_SUSPICIOUS_DEVICE=boolean
NUMBER_OF_TOTAL_RUNS=INT
NUMBER_OF_CONCURRENT_RUNS=INT #Recommended around 20 - 40
DEBUG=boolean
INCLUDE_SDK=boolean
PROCESS_USERS_SEQUENTIALLY=boolean
FORCED_RISK_LEVEL=LOW | MEDIUM | HIGH | true | false
```

### **Modifying User Type in Requests**
To change between **internal and external users** in the request, modify the `sdkRequestData.json` file:

- **For External Users**:
```json
"user": {
    "id": "{USER_ID}",
    "type": "EXTERNAL"
}
```

- **For PingOne Users**:
```json
"user": {
    "name": "{USER_ID}",
    "type": "PING_ONE"
}
```

  ### **Tracking User Profiles in Requests**
The `user_profile.json` file is used to track user and device data across iterations of a run. When a user first interacts with the system, a profile is created containing their **device ID** and **browser information**. This profile is then leveraged in subsequent requests to ensure the user appears consistent across different interactions. If you would like to reset or update the user, update this profile or delete the users profile, and a new item will be created.

## Project Structure
```
ProtectSynth/
├── data/               # Contains datasets
├── sendDataWithSDKClean.js  # Main logic script
├── package.json        # Node.js package configuration
├── .vscode/            # VS Code settings (if applicable)
└── README.md           # Project documentation
```

## Contributing
Feel free to submit issues or pull requests if you'd like to contribute.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
