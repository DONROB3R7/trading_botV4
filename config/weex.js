const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const config = {
  apiKey: process.env.WEEX_API_KEY || "",
  apiSecret: process.env.WEEX_API_SECRET || "",
  passphrase: process.env.WEEX_API_PASSPHRASE || "",

  baseUrl:
    process.env.WEEX_API_BASE ||
    "https://api-contract.weex.com",

  locale:
    process.env.WEEX_LOCALE ||
    "en-US",

  port:
    Number(process.env.PORT) ||
    3001,
};

function validateCredentials() {
  const missing = [];

  if (!config.apiKey) {
    missing.push("WEEX_API_KEY");
  }

  if (!config.apiSecret) {
    missing.push("WEEX_API_SECRET");
  }

  if (!config.passphrase) {
    missing.push("WEEX_API_PASSPHRASE");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing WEEX credentials: ${missing.join(", ")}`
    );
  }
}

module.exports = {
  config,
  validateCredentials,
};