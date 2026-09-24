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
    this.baseUrl =
      config.baseUrl.replace(/\/+$/, "");

    this.apiKey =
      config.apiKey;

    this.apiSecret =
      config.apiSecret;

    this.passphrase =
      config.passphrase;

    this.locale =
      config.locale;
  }

  // ==========================================================
  // PRESERVE LARGE WEEX IDS
  // ==========================================================
  //
  // WEEX returns Long IDs such as:
  //
  // 798020755794166700
  //
  // JavaScript Number cannot safely represent these values.
  //
  // If we call JSON.parse() directly, the ID can be rounded.
  //
  // We convert known WEEX ID fields to JSON strings BEFORE
  // JSON.parse() sees them.
  //
  // ==========================================================

  preserveLargeIds(rawText) {
    if (
      typeof rawText !==
      "string"
    ) {
      return rawText;
    }

    return rawText.replace(
      /("(?:orderId|algoId|actualOrderId)"\s*:\s*)(-?\d+)/g,
      '$1"$2"'
    );
  }

  // ==========================================================
  // SERIALIZE BODY
  // ==========================================================
  //
  // For modifyTpSlOrder, WEEX documents orderId as a Long.
  //
  // We keep the exact ID as a string internally, then put the
  // exact digits back into the outgoing JSON WITHOUT allowing
  // JavaScript to convert them to Number first.
  //
  // Example:
  //
  // internal:
  // "798020755794166700"
  //
  // outgoing JSON:
  // "orderId":798020755794166700
  //
  // ==========================================================

  serializeBody(body) {
    const json =
      JSON.stringify(body);

    if (
      !json ||
      typeof json !==
        "string"
    ) {
      return json;
    }

    return json.replace(
      /("(?:orderId)"\s*:\s*)"(\d+)"/g,
      "$1$2"
    );
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
      message +=
        `?${queryString}`;
    }

    message += body;

    const digest =
      crypto
        .createHmac(
          "sha256",
          this.apiSecret
        )
        .update(message)
        .digest("base64");

    return digest;
  }

  // ==========================================================
  // QUERY STRING
  // ==========================================================

  buildQueryString(
    query = {}
  ) {
    const entries =
      Object.entries(query);

    if (
      entries.length === 0
    ) {
      return "";
    }

    return new URLSearchParams(
      entries.map(
        ([key, value]) => [
          key,
          String(value),
        ]
      )
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
      throw new Error(
        "WEEX request path is required"
      );
    }

    const upperMethod =
      method.toUpperCase();

    const queryString =
      this.buildQueryString(
        query
      );

    // --------------------------------------------------------
    // IMPORTANT:
    //
    // Use our serializer instead of JSON.stringify directly.
    // --------------------------------------------------------

    const bodyString =
      body === null ||
      body === undefined
        ? ""
        : this.serializeBody(
            body
          );

    const timestamp =
      String(Date.now());

    const headers = {
      Accept:
        "application/json",

      "Content-Type":
        "application/json",

      "User-Agent":
        "WEEX-BOT-V4",

      locale:
        this.locale,
    };

    // ========================================================
    // AUTH
    // ========================================================

    if (auth) {
      validateCredentials();

      const signature =
        this.createSignature({
          timestamp,
          method:
            upperMethod,
          requestPath:
            path,
          queryString,
          body:
            bodyString,
        });

      headers[
        "ACCESS-KEY"
      ] =
        this.apiKey;

      headers[
        "ACCESS-PASSPHRASE"
      ] =
        this.passphrase;

      headers[
        "ACCESS-TIMESTAMP"
      ] =
        timestamp;

      headers[
        "ACCESS-SIGN"
      ] =
        signature;
    }

    // ========================================================
    // URL
    // ========================================================

    let url =
      `${this.baseUrl}${path}`;

    if (queryString) {
      url +=
        `?${queryString}`;
    }

    console.log(
      `[WEEX] ${upperMethod} ${path}`
    );

    // ========================================================
    // REQUEST
    // ========================================================

    const response =
      await fetch(
        url,
        {
          method:
            upperMethod,

          headers,

          body:
            upperMethod ===
              "GET" ||
            upperMethod ===
              "DELETE"
              ? undefined
              : bodyString,
        }
      );

    // ========================================================
    // RAW RESPONSE
    // ========================================================

    const rawText =
      await response.text();

    let data;

    try {
      // ------------------------------------------------------
      // CRITICAL:
      //
      // Preserve large WEEX IDs BEFORE JSON.parse().
      // ------------------------------------------------------

      const safeJson =
        this.preserveLargeIds(
          rawText
        );

      data =
        safeJson
          ? JSON.parse(
              safeJson
            )
          : null;

    } catch {
      data = {
        raw:
          rawText,
      };
    }

    // ========================================================
    // ERROR
    // ========================================================

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

    // ========================================================
    // RETURN
    // ========================================================

    return {
      status:
        response.status,

      data,
    };
  }

  // ==========================================================
  // GET
  // ==========================================================

  async get(
    path,
    query = {},
    auth = true
  ) {
    return this.request({
      method:
        "GET",

      path,

      query,

      auth,
    });
  }

  // ==========================================================
  // POST
  // ==========================================================

  async post(
    path,
    body = {},
    auth = true
  ) {
    return this.request({
      method:
        "POST",

      path,

      body,

      auth,
    });
  }
}

module.exports =
  WeexClient;
