const axios = require("axios");

// Hardcoded as requested
const ULIP_LOGIN_URL = "https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/user/login";
const ULIP_EWAYBILL_URL = "https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/EWAYBILL/01";
const ULIP_USERNAME = "krov_moveai_usr";
const ULIP_PASSWORD = "aS6fWZ*QMC";
const EWB_NO = "101000609218";

async function main() {
  try {
    // 1) Login to ULIP and fetch bearer token
    const loginResp = await axios.post(
      ULIP_LOGIN_URL,
      {
        username: ULIP_USERNAME,
        password: ULIP_PASSWORD
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        timeout: 15000
      }
    );

    const loginData = loginResp.data;
    const token =
      loginData?.response?.id ??
      loginData?.id ??
      loginData?.token ??
      loginData?.access_token ??
      loginData?.accessToken;

    if (!token) {
      console.error("Login response did not include a token.");
      console.error(JSON.stringify(loginData, null, 2));
      process.exit(1);
    }

    // 2) Call EWAYBILL/01 using login token
    const ewaybillResp = await axios.post(
      ULIP_EWAYBILL_URL,
      {
        ewbNo: EWB_NO
      },
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    console.log("EWAYBILL/01 response:");
    console.log(JSON.stringify(ewaybillResp.data, null, 2));
  } catch (error) {
    console.error("Request failed:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main();

