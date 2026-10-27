import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Track } from '../types/music';

export interface OfflineTrackRecord {
  trackId: string;
  track: Track;
  downloadedAt: string;
  sizeBytes: number;
  mimeType: string;
  nativeFilePath?: string;
}

export interface BiometricEnrollment {
  email: string;
  displayName: string;
  role: string;
  token: string;
  csrfToken?: string | null;
  credentialId?: string;
  enrolledAt: string;
}

const OFFLINE_MANIFEST_KEY = 'flontmie_offline_tracks_v1';
const BIOMETRIC_ENROLL_KEY = 'flontmie_biometric_enrollment_v1';
const SECURE_JWT_KEY = 'flontmie_secure_jwt';
const SECURE_CSRF_KEY = 'flontmie_secure_csrf';
const IDB_NAME = 'flontmie_offline_audio_db';
const IDB_STORE = 'audio_blobs';

// --- IndexedDB Helper for Web Offline Audio Blob Storage ---
function openOfflineIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBlobToIdb(trackId: string, blob: Blob): Promise<void> {
  const db = await openOfflineIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, trackId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlobFromIdb(trackId: string): Promise<Blob | null> {
  try {
    const db = await openOfflineIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(trackId);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function deleteBlobFromIdb(trackId: string): Promise<void> {
  try {
    const db = await openOfflineIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(trackId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return window.btoa(binary);
}

class FlontmieNativePlatformService {
  private offlineRecords: Record<string, OfflineTrackRecord> = {};
  private blobUrlCache: Record<string, string> = {};
  private networkListeners: Set<(isOnline: boolean, connectionType: string) => void> = new Set();
  private offlineListeners: Set<(records: Record<string, OfflineTrackRecord>) => void> = new Set();
  private isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private connectionTypeState: string = 'wifi';
  private initialized: boolean = false;

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getPlatform(): string {
    return Capacitor.getPlatform();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Load offline manifest from Capacitor Preferences / localStorage
    await this.loadOfflineManifest();

    // 2. Initialize Network Monitoring
    try {
      const status = await Network.getStatus();
      this.isOnlineState = status.connected;
      this.connectionTypeState = status.connectionType;
      this.notifyNetworkListeners();

      Network.addListener('networkStatusChange', (s) => {
        this.isOnlineState = s.connected;
        this.connectionTypeState = s.connectionType;
        this.notifyNetworkListeners();
      });
    } catch {
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          this.isOnlineState = true;
          this.connectionTypeState = 'online';
          this.notifyNetworkListeners();
        });
        window.addEventListener('offline', () => {
          this.isOnlineState = false;
          this.connectionTypeState = 'none';
          this.notifyNetworkListeners();
        });
      }
    }

    // 3. Configure Native StatusBar & SplashScreen when running in Capacitor Android/iOS
    if (this.isNative()) {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#09090b' });
      } catch {}
      try {
        await SplashScreen.hide();
      } catch {}
    }
  }

  // --- Secure Token Storage via Capacitor Preferences ---
  public async saveAuthTokens(token: string | null, csrfToken?: string | null): Promise<void> {
    try {
      if (token) {
        await Preferences.set({ key: SECURE_JWT_KEY, value: token });
      } else {
        await Preferences.remove({ key: SECURE_JWT_KEY });
      }
      if (csrfToken) {
        await Preferences.set({ key: SECURE_CSRF_KEY, value: csrfToken });
      } else if (token === null) {
        await Preferences.remove({ key: SECURE_CSRF_KEY });
      }
    } catch {}
  }

  public async getStoredAuthTokens(): Promise<{ token: string | null; csrfToken: string | null }> {
    try {
      const [jwtRes, csrfRes] = await Promise.all([
        Preferences.get({ key: SECURE_JWT_KEY }),
        Preferences.get({ key: SECURE_CSRF_KEY }),
      ]);
      return {
        token: jwtRes.value || (typeof localStorage !== 'undefined' ? localStorage.getItem('flontmie_jwt') : null),
        csrfToken: csrfRes.value || (typeof localStorage !== 'undefined' ? localStorage.getItem('flontmie_csrf') : null),
      };
    } catch {
      return {
        token: typeof localStorage !== 'undefined' ? localStorage.getItem('flontmie_jwt') : null,
        csrfToken: typeof localStorage !== 'undefined' ? localStorage.getItem('flontmie_csrf') : null,
      };
    }
  }

  // --- Network Status Detection ---
  public isOnline(): boolean {
    return this.isOnlineState;
  }

  public getConnectionType(): string {
    return this.connectionTypeState;
  }

  public subscribeNetworkStatus(cb: (isOnline: boolean, connectionType: string) => void): () => void {
    this.networkListeners.add(cb);
    cb(this.isOnlineState, this.connectionTypeState);
    return () => {
      this.networkListeners.delete(cb);
    };
  }

  public onNetworkChange(cb: (isOnline: boolean, connectionType: string) => void): () => void {
    return this.subscribeNetworkStatus(cb);
  }

  private notifyNetworkListeners() {
    this.networkListeners.forEach((cb) => cb(this.isOnlineState, this.connectionTypeState));
  }

  // --- Android Runtime Permissions Handling ---
  public async requestDevicePermissions(): Promise<{
    notifications: boolean;
    storage: boolean;
  }> {
    let notificationsGranted = false;
    let storageGranted = true;

    try {
      const notifPerm = await LocalNotifications.checkPermissions();
      if (notifPerm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        notificationsGranted = req.display === 'granted';
      } else {
        notificationsGranted = true;
      }
    } catch {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          notificationsGranted = true;
        } else if (Notification.permission !== 'denied') {
          const p = await Notification.requestPermission();
          notificationsGranted = p === 'granted';
        }
      }
    }

    if (this.isNative()) {
      try {
        const fsPerm = await Filesystem.checkPermissions();
        if (fsPerm.publicStorage !== 'granted') {
          const req = await Filesystem.requestPermissions();
          storageGranted = req.publicStorage === 'granted';
        }
      } catch {
        storageGranted = true;
      }
    }

    return { notifications: notificationsGranted, storage: storageGranted };
  }

  // --- Offline Track Download & Secure Storage ---
  private async loadOfflineManifest(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: OFFLINE_MANIFEST_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          this.offlineRecords = parsed;
          this.notifyOfflineListeners();
          return;
        }
      }
    } catch {}
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(OFFLINE_MANIFEST_KEY);
        if (raw) {
          this.offlineRecords = JSON.parse(raw);
          this.notifyOfflineListeners();
        }
      } catch {}
    }
  }

  private async persistOfflineManifest(): Promise<void> {
    const serialized = JSON.stringify(this.offlineRecords);
    try {
      await Preferences.set({ key: OFFLINE_MANIFEST_KEY, value: serialized });
    } catch {}
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(OFFLINE_MANIFEST_KEY, serialized);
      } catch {}
    }
    this.notifyOfflineListeners();
  }

  public subscribeOfflineTracks(cb: (records: Record<string, OfflineTrackRecord>) => void): () => void {
    this.offlineListeners.add(cb);
    cb({ ...this.offlineRecords });
    return () => {
      this.offlineListeners.delete(cb);
    };
  }

  private notifyOfflineListeners() {
    const snapshot = { ...this.offlineRecords };
    this.offlineListeners.forEach((cb) => cb(snapshot));
  }

  public canDownloadTrack(track: Track | null | undefined): boolean {
    if (!track) return false;
    if (track.status && track.status !== 'active') return false;
    return Boolean(track.audioUrl && (track.hasLocalAudio !== false));
  }

  public isTrackDownloaded(trackId: string): boolean {
    return Boolean(this.offlineRecords[trackId]);
  }

  public getDownloadedTracks(): Track[] {
    return Object.values(this.offlineRecords)
      .sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt))
      .map((r) => r.track);
  }

  public getOfflineStorageBytes(): number {
    return Object.values(this.offlineRecords).reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
  }

  public async downloadTrackForOffline(
    track: Track,
    onProgress?: (percent: number) => void
  ): Promise<OfflineTrackRecord> {
    if (!this.canDownloadTrack(track)) {
      throw new Error('This track is not licensed or available for offline download.');
    }

    if (onProgress) onProgress(5);

    const response = await fetch(track.audioUrl!);
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }

    const contentType = response.headers.get('Content-Type') || 'audio/mp4';
    const contentLength = Number(response.headers.get('Content-Length') || 0);

    let arrayBuffer: ArrayBuffer;
    if (response.body && contentLength > 0) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (onProgress) {
            onProgress(Math.min(95, Math.round((received / contentLength) * 90) + 5));
          }
        }
      }
      const merged = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      arrayBuffer = merged.buffer;
    } else {
      arrayBuffer = await response.arrayBuffer();
      if (onProgress) onProgress(90);
    }

    const ext = contentType.includes('mpeg') ? 'mp3' : contentType.includes('wav') ? 'wav' : 'm4a';
    const safeId = track.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const relPath = `flontmie_offline/tracks/${safeId}.${ext}`;
    let nativeFilePath: string | undefined;

    if (this.isNative()) {
      const base64Data = arrayBufferToBase64(arrayBuffer);
      await Filesystem.writeFile({
        path: relPath,
        data: base64Data,
        directory: Directory.Data,
        recursive: true,
      });
      const uriResult = await Filesystem.getUri({
        path: relPath,
        directory: Directory.Data,
      });
      nativeFilePath = uriResult.uri;
    } else {
      const blob = new Blob([arrayBuffer], { type: contentType });
      await saveBlobToIdb(track.id, blob);
    }

    const record: OfflineTrackRecord = {
      trackId: track.id,
      track: { ...track, hasLocalAudio: true },
      downloadedAt: new Date().toISOString(),
      sizeBytes: arrayBuffer.byteLength,
      mimeType: contentType,
      nativeFilePath,
    };

    this.offlineRecords[track.id] = record;
    await this.persistOfflineManifest();

    if (onProgress) onProgress(100);

    // Trigger native notification if permitted
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000) + 1,
            title: 'Available Offline',
            body: `${track.title} by ${track.artist} downloaded for offline listening.`,
            schedule: { at: new Date(Date.now() + 300) },
          },
        ],
      });
    } catch {}

    return record;
  }

  public async removeOfflineTrack(trackId: string): Promise<void> {
    const existing = this.offlineRecords[trackId];
    if (!existing) return;

    if (this.blobUrlCache[trackId]) {
      try {
        URL.revokeObjectURL(this.blobUrlCache[trackId]);
      } catch {}
      delete this.blobUrlCache[trackId];
    }

    if (this.isNative()) {
      const safeId = trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
      for (const ext of ['m4a', 'mp3', 'wav']) {
        try {
          await Filesystem.deleteFile({
            path: `flontmie_offline/tracks/${safeId}.${ext}`,
            directory: Directory.Data,
          });
        } catch {}
      }
    } else {
      await deleteBlobFromIdb(trackId);
    }

    delete this.offlineRecords[trackId];
    await this.persistOfflineManifest();
  }

  public async getOfflinePlaybackUrl(trackId: string): Promise<string | null> {
    const rec = this.offlineRecords[trackId];
    if (!rec) return null;

    if (this.blobUrlCache[trackId]) {
      return this.blobUrlCache[trackId];
    }

    if (this.isNative() && rec.nativeFilePath) {
      try {
        return Capacitor.convertFileSrc(rec.nativeFilePath);
      } catch {
        return rec.nativeFilePath;
      }
    }

    const blob = await getBlobFromIdb(trackId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      this.blobUrlCache[trackId] = url;
      return url;
    }

    return null;
  }

  // --- Fingerprint / Biometric Authentication ---
  public async isBiometricSupported(): Promise<boolean> {
    if (this.isNative()) {
      return true;
    }
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return false;
      }
    }
    return false;
  }

  public async isBiometricAvailable(): Promise<boolean> {
    return this.isBiometricSupported();
  }

  public async getBiometricEnrollment(): Promise<BiometricEnrollment | null> {
    try {
      const { value } = await Preferences.get({ key: BIOMETRIC_ENROLL_KEY });
      if (value) {
        return JSON.parse(value) as BiometricEnrollment;
      }
    } catch {}
    return null;
  }

  public async isBiometricEnrolled(): Promise<boolean> {
    const enrollment = await this.getBiometricEnrollment();
    return Boolean(enrollment && enrollment.email);
  }

  public async enrollBiometricSession(email: string, displayName: string): Promise<BiometricEnrollment> {
    const stored = await this.getStoredAuthTokens();
    return this.enrollBiometricAuth({
      email,
      display_name: displayName,
      role: 'listener',
      token: stored.token || '',
      csrf_token: stored.csrfToken,
    });
  }

  public async enrollBiometricAuth(user: {
    email: string;
    display_name: string;
    role: string;
    token: string;
    csrf_token?: string | null;
  }): Promise<BiometricEnrollment> {
    let credentialId: string | undefined;

    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function'
    ) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userIdBytes = new TextEncoder().encode(user.email);

        const cred = (await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: 'Flontmie Music' },
            user: {
              id: userIdBytes,
              name: user.email,
              displayName: user.display_name || user.email,
            },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 },
              { type: 'public-key', alg: -257 },
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 45000,
          },
        })) as PublicKeyCredential | null;

        if (cred && cred.rawId) {
          credentialId = arrayBufferToBase64(cred.rawId);
        }
      } catch (err: any) {
        if (err && err.name === 'NotAllowedError') {
          throw new Error('Fingerprint / biometric verification was cancelled.');
        }
      }
    }

    const enrollment: BiometricEnrollment = {
      email: user.email,
      displayName: user.display_name || user.email,
      role: user.role,
      token: user.token,
      csrfToken: user.csrf_token || null,
      credentialId,
      enrolledAt: new Date().toISOString(),
    };

    await Preferences.set({
      key: BIOMETRIC_ENROLL_KEY,
      value: JSON.stringify(enrollment),
    });

    return enrollment;
  }

  public async authenticateWithBiometrics(): Promise<{
    verified: boolean;
    error?: string;
    enrollment?: BiometricEnrollment;
  }> {
    const enrollment = await this.getBiometricEnrollment();
    if (!enrollment) {
      return {
        verified: false,
        error: 'No fingerprint/biometric account is enrolled on this device yet. Sign in with password first to enable it.',
      };
    }

    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.get === 'function' &&
      enrollment.credentialId
    ) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            userVerification: 'required',
            timeout: 45000,
          },
        });
        if (!assertion) {
          return { verified: false, error: 'Biometric verification failed.' };
        }
      } catch (err: any) {
        return { verified: false, error: err?.message || 'Biometric verification cancelled.' };
      }
    }

    if (enrollment.token) {
      await this.saveAuthTokens(enrollment.token, enrollment.csrfToken || null);
    }

    return { verified: true, enrollment };
  }

  public async clearBiometricEnrollment(): Promise<void> {
    await Preferences.remove({ key: BIOMETRIC_ENROLL_KEY });
  }

  // --- Native Share Sheet ---
  public async shareContent(params: { title: string; text: string; url: string }): Promise<boolean> {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: params.title,
          text: params.text,
          url: params.url,
          dialogTitle: `Share ${params.title}`,
        });
        return true;
      }
    } catch {}
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(params);
        return true;
      } catch {}
    }
    return false;
  }

  // --- Android Hardware Back Button Navigation ---
  public registerBackButtonHandler(onBack: () => boolean): () => void {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    if (this.isNative()) {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        const handled = onBack();
        if (!handled) {
          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.minimizeApp().catch(() => {});
          }
        }
      }).then((h) => {
        listenerHandle = h;
      }).catch(() => {});
    }
    return () => {
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }
}

export const nativePlatform = new FlontmieNativePlatformService();
