const crypto = require("crypto");

const {
  config,
  validateCredentials,
} = require("../config/weex");

// ============================================================
// WEEX CLIENT
// ============================================================

class WeexClient {
  constructor() {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.passphrase = config.passphrase;
    this.locale = config.locale;
  }

  // ==========================================================
  // SIGNATURE
  // ==========================================================

  createSignature({
    timestamp,
    method,
    requestPath,
    queryString = "",
    body = "",
  }) {
    let message =
      String(timestamp) +
      method.toUpperCase() +
      requestPath;

    if (queryString) {
      message += `?${queryString}`;
    }

    message += body;

    const digest = crypto
      .createHmac("sha256", this.apiSecret)
      .update(message)
      .digest("base64");

    return digest;
  }

  // ==========================================================
  // QUERY STRING
  // ==========================================================

  buildQueryString(query = {}) {
    const entries = Object.entries(query);

    if (entries.length === 0) {
      return "";
    }

    return new URLSearchParams(
      entries.map(([key, value]) => [
        key,
        String(value),
      ])
    ).toString();
  }

  // ==========================================================
  // REQUEST
  // ==========================================================

  async request({
    method = "GET",
    path,
    query = {},
    body = null,
    auth = true,
  }) {
    if (!path) {
      throw new Error("WEEX request path is required");
    }

    const upperMethod = method.toUpperCase();

    const queryString =
      this.buildQueryString(query);

    const bodyString =
      body === null || body === undefined
        ? ""
        : JSON.stringify(body);

    const timestamp =
      String(Date.now());

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "WEEX-BOT-V4",
      locale: this.locale,
    };

    if (auth) {
      validateCredentials();

      const signature =
        this.createSignature({
          timestamp,
          method: upperMethod,
          requestPath: path,
          queryString,
          body: bodyString,
        });

      headers["ACCESS-KEY"] =
        this.apiKey;

      headers["ACCESS-PASSPHRASE"] =
        this.passphrase;

      headers["ACCESS-TIMESTAMP"] =
        timestamp;

      headers["ACCESS-SIGN"] =
        signature;
    }

    let url =
      `${this.baseUrl}${path}`;

    if (queryString) {
      url += `?${queryString}`;
    }

    console.log(
      `[WEEX] ${upperMethod} ${path}`
    );

    const response =
      await fetch(url, {
        method: upperMethod,
        headers,
        body:
          upperMethod === "GET" ||
          upperMethod === "DELETE"
            ? undefined
            : bodyString,
      });

    const rawText =
      await response.text();

    let data;

    try {
      data =
        rawText
          ? JSON.parse(rawText)
          : null;
    } catch {
      data = {
        raw: rawText,
      };
    }

    if (!response.ok) {
      const error =
        new Error(
          `WEEX HTTP ${response.status}`
        );

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    return {
      status: response.status,
      data,
    };
  }

  // ==========================================================
  // GET
  // ==========================================================

  async get(path, query = {}, auth = true) {
    return this.request({
      method: "GET",
      path,
      query,
      auth,
    });
  }

  // ==========================================================
  // POST
  // ==========================================================

  async post(path, body = {}, auth = true) {
    return this.request({
      method: "POST",
      path,
      body,
      auth,
    });
  }
}

module.exports = WeexClient;