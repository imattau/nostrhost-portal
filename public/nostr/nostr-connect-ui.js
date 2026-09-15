/*
 * Shared Nostr signer helpers for /nostr-login and /nostr-account. Wraps
 * window.NostrConnectVendor (the vendored nostr-tools bundle - see
 * vendor/nostr-connect/) with:
 *   - NIP-46: pasting a bunker:// link (or NIP-05 signer address), or
 *     scanning a nostrconnect:// QR code - saved in localStorage so a
 *     returning visitor doesn't have to reconnect every time.
 *   - a locally-generated keypair, for someone who doesn't have a Nostr
 *     identity yet - deliberately NOT saved unless the caller explicitly
 *     asks (see saveLocalKey): keeping raw key material in localStorage by
 *     default would be the same risk class as storing a password there.
 *
 * Every flow here produces a signer with the same async signEvent(event)
 * shape NIP-07's window.nostr.signEvent() has - the pages that use this
 * treat all of them the same way past that point (PLAN.md: "NIP-07 and
 * NIP-46 should ultimately feed the same verification pipeline").
 */
window.NostrConnectUI = (function () {
  "use strict";

  // Legacy single-slot key (pre-multi-session). Migrated into
  // BUNKER_LIST_STORAGE_KEY on first load and then left alone.
  var LEGACY_BUNKER_STORAGE_KEY = "nostrAuthSavedSigner";
  var BUNKER_LIST_STORAGE_KEY = "nostrAuthSavedSigners";
  var LOCAL_KEY_STORAGE_KEY = "nostrAuthLocalKey";
  // Well-known public relays that support NIP-46 traffic, used only for
  // the nostrconnect:// (QR) flow, where this page - not the user's
  // signer - has to pick where to listen. The bunker:// flow doesn't need
  // this: the relay is already in the pasted URI.
  var DEFAULT_QR_RELAYS = ["wss://relay.nsec.app", "wss://relay.damus.io"];
  var CONNECT_TIMEOUT_MS = 120000;

  function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
  }

  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // --- NIP-46 (bunker:// / nostrconnect://) ---------------------------
  //
  // Multiple bunker connections can be saved at once (one per remote
  // signer pubkey), each identified by a server-visible sessionId. The
  // client secret key never leaves this array/localStorage - the server
  // (see nostr-account.vue's session sync) is only ever told the remote
  // signer's pubkey, relays and a label, for the account page's "connected
  // signers" list. A migration step folds the old single-slot key in once.

  function genSessionId() {
    return bytesToHex(window.NostrConnectVendor.generateSecretKey()).slice(0, 32);
  }

  function loadSavedList() {
    try {
      var raw = localStorage.getItem(BUNKER_LIST_STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveSavedList(list) {
    try {
      localStorage.setItem(BUNKER_LIST_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // Storage unavailable/full - not fatal, just no "reconnect" convenience next time.
    }
  }

  function migrateLegacyIfNeeded() {
    var already = localStorage.getItem(BUNKER_LIST_STORAGE_KEY);
    if (already !== null) return;
    try {
      var raw = localStorage.getItem(LEGACY_BUNKER_STORAGE_KEY);
      if (!raw) {
        saveSavedList([]);
        return;
      }
      var legacy = JSON.parse(raw);
      saveSavedList([
        {
          sessionId: genSessionId(),
          clientSecretKeyHex: legacy.clientSecretKeyHex,
          bunkerPointer: legacy.bunkerPointer,
          label: null,
          connectedAt: Date.now(),
        },
      ]);
      localStorage.removeItem(LEGACY_BUNKER_STORAGE_KEY);
    } catch (e) {
      saveSavedList([]);
    }
  }

  function loadSavedBunker() {
    migrateLegacyIfNeeded();
    var list = loadSavedList();
    return list.length ? list[list.length - 1] : null;
  }

  // Adds or updates (by remote signer pubkey) a saved session; returns it.
  function saveBunker(clientSecretKey, bunkerPointer, label) {
    migrateLegacyIfNeeded();
    var list = loadSavedList();
    var entry = {
      sessionId: genSessionId(),
      clientSecretKeyHex: bytesToHex(clientSecretKey),
      bunkerPointer: bunkerPointer,
      label: label || null,
      connectedAt: Date.now(),
    };
    var existingIdx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].bunkerPointer.pubkey === bunkerPointer.pubkey) {
        existingIdx = i;
        break;
      }
    }
    if (existingIdx >= 0) {
      entry.sessionId = list[existingIdx].sessionId; // keep the id the server already knows
      list[existingIdx] = entry;
    } else {
      list.push(entry);
    }
    saveSavedList(list);
    return entry;
  }

  function clearSaved() {
    saveSavedList([]);
    try {
      localStorage.removeItem(LEGACY_BUNKER_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }

  function forgetSession(sessionId) {
    migrateLegacyIfNeeded();
    saveSavedList(
      loadSavedList().filter(function (s) {
        return s.sessionId !== sessionId;
      })
    );
  }

  function hasSaved() {
    migrateLegacyIfNeeded();
    return loadSavedList().length > 0;
  }

  // For a "connected via remote signer" settings panel: who/where, without
  // exposing the client secret key itself. Kept for backward compatibility
  // (returns the most recently connected session); listSavedSessions()
  // below returns all of them.
  function getSavedInfo() {
    var saved = loadSavedBunker();
    if (!saved) return null;
    var vendor = window.NostrConnectVendor;
    return {
      relays: saved.bunkerPointer.relays,
      remoteNpub: vendor.npubEncode(saved.bunkerPointer.pubkey),
    };
  }

  // Every saved session, newest first, without any secret key material.
  function listSavedSessions() {
    migrateLegacyIfNeeded();
    var vendor = window.NostrConnectVendor;
    return loadSavedList()
      .slice()
      .reverse()
      .map(function (s) {
        return {
          sessionId: s.sessionId,
          relays: s.bunkerPointer.relays,
          remoteNpub: vendor.npubEncode(s.bunkerPointer.pubkey),
          remotePubkey: s.bunkerPointer.pubkey,
          label: s.label,
          connectedAt: s.connectedAt,
        };
      });
  }

  async function connectViaBunkerUri(bunkerUriOrNip05, label) {
    var vendor = window.NostrConnectVendor;
    var bp = await vendor.parseBunkerInput(bunkerUriOrNip05);
    if (!bp) {
      throw new Error("That doesn't look like a valid bunker:// link or NIP-05 signer address.");
    }
    var clientSecretKey = vendor.generateSecretKey();
    var signer = vendor.BunkerSigner.fromBunker(clientSecretKey, bp);
    await signer.connect();
    var entry = saveBunker(clientSecretKey, bp, label);
    signer.sessionId = entry.sessionId;
    return signer;
  }

  async function connectViaQr(onUriReady, abortSignal, label) {
    var vendor = window.NostrConnectVendor;
    var clientSecretKey = vendor.generateSecretKey();
    var clientPubkey = vendor.getPublicKey(clientSecretKey);
    var secret = bytesToHex(vendor.generateSecretKey()).slice(0, 16);
    var uri = vendor.createNostrConnectURI({
      clientPubkey: clientPubkey,
      relays: DEFAULT_QR_RELAYS,
      secret: secret,
      name: document.title,
    });
    var qrDataUrl = await vendor.QRCode.toDataURL(uri, { width: 240, margin: 1 });
    onUriReady(uri, qrDataUrl);
    // fromURI accepts either a timeout in ms or an AbortSignal - pass
    // whichever the caller gave us so cancelling (e.g. a "Cancel" button)
    // actually closes the relay subscription immediately, rather than
    // leaving it running until CONNECT_TIMEOUT_MS anyway.
    var signer = await vendor.BunkerSigner.fromURI(
      clientSecretKey,
      uri,
      {},
      abortSignal || CONNECT_TIMEOUT_MS
    );
    var entry = saveBunker(clientSecretKey, signer.bp, label);
    signer.sessionId = entry.sessionId;
    return signer;
  }

  async function reconnectSaved() {
    var saved = loadSavedBunker();
    if (!saved) return null;
    var vendor = window.NostrConnectVendor;
    var clientSecretKey = hexToBytes(saved.clientSecretKeyHex);
    var signer = vendor.BunkerSigner.fromBunker(clientSecretKey, saved.bunkerPointer);
    await signer.connect();
    signer.sessionId = saved.sessionId;
    return signer;
  }

  async function reconnectSession(sessionId) {
    var saved = loadSavedList().filter(function (s) {
      return s.sessionId === sessionId;
    })[0];
    if (!saved) return null;
    var vendor = window.NostrConnectVendor;
    var clientSecretKey = hexToBytes(saved.clientSecretKeyHex);
    var signer = vendor.BunkerSigner.fromBunker(clientSecretKey, saved.bunkerPointer);
    await signer.connect();
    signer.sessionId = saved.sessionId;
    return signer;
  }

  // --- Locally-generated keypair ---------------------------------------
  //
  // For someone with no Nostr identity yet. Signing happens entirely in
  // this page (no relay, no extension) via a small signer-shaped wrapper
  // around nostr-tools' finalizeEvent. Not persisted unless saveLocalKey()
  // is called explicitly - see that function's own warning.

  function generateLocalKeypair() {
    var vendor = window.NostrConnectVendor;
    var secretKey = vendor.generateSecretKey();
    var pubkeyHex = vendor.getPublicKey(secretKey);
    return {
      secretKeyHex: bytesToHex(secretKey),
      pubkeyHex: pubkeyHex,
      nsec: vendor.nsecEncode(secretKey),
      npub: vendor.npubEncode(pubkeyHex),
    };
  }

  function createLocalSigner(secretKeyHex) {
    var vendor = window.NostrConnectVendor;
    var secretKey = hexToBytes(secretKeyHex);
    return {
      signEvent: async function (event) {
        return vendor.finalizeEvent(event, secretKey);
      },
      close: async function () {},
    };
  }

  // Deliberately separate from connectViaBunkerUri/connectViaQr's
  // automatic save(): a caller must opt in explicitly (PLAN.md's "generate
  // a keypair" consideration - storing raw key material in localStorage by
  // default is the same risk class as storing a password there, so the
  // page this is called from must show that trade-off, not assume it).
  function saveLocalKey(secretKeyHex) {
    try {
      localStorage.setItem(LOCAL_KEY_STORAGE_KEY, secretKeyHex);
    } catch (e) {
      // ignore - not fatal, just no "sign in with saved key" convenience
    }
  }

  function hasLocalKey() {
    try {
      return !!localStorage.getItem(LOCAL_KEY_STORAGE_KEY);
    } catch (e) {
      return false;
    }
  }

  function loadLocalSigner() {
    var secretKeyHex;
    try {
      secretKeyHex = localStorage.getItem(LOCAL_KEY_STORAGE_KEY);
    } catch (e) {
      return null;
    }
    return secretKeyHex ? createLocalSigner(secretKeyHex) : null;
  }

  function clearLocalKey() {
    try {
      localStorage.removeItem(LOCAL_KEY_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }

  // Both kinds of saved signer represent "a way to sign in/link as the
  // identity that was just unlinked" - clearing only one on unlink would
  // leave a stale one behind.
  function clearAllSaved() {
    clearSaved();
    clearLocalKey();
  }

  return {
    hasSaved: hasSaved,
    getSavedInfo: getSavedInfo,
    listSavedSessions: listSavedSessions,
    reconnectSaved: reconnectSaved,
    reconnectSession: reconnectSession,
    forgetSession: forgetSession,
    connectViaBunkerUri: connectViaBunkerUri,
    connectViaQr: connectViaQr,
    clearSaved: clearSaved,
    generateLocalKeypair: generateLocalKeypair,
    createLocalSigner: createLocalSigner,
    saveLocalKey: saveLocalKey,
    hasLocalKey: hasLocalKey,
    loadLocalSigner: loadLocalSigner,
    clearLocalKey: clearLocalKey,
    clearAllSaved: clearAllSaved,
  };
})();
