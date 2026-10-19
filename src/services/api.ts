/**
 * Flontmie Production API Client
 * Connects frontend directly to the PHP / MySQL backend
 */

import { Track, Playlist, ArtistProfile, LyricLine, ArtistDiscographyItem, RelatedArtistItem } from '../types/music';
import { resolveArtworkUrl } from '../utils/artwork';

function parseLyricsToLines(raw: any, duration: number = 180): LyricLine[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const step = Math.max(4, Math.floor((duration - 10) / Math.max(1, lines.length)));
    return lines.map((text, idx) => ({
      time: 4 + idx * step,
      text,
    }));
  }
  return [];
}

function extractVideoId(t: any): string | undefined {
  if (t.video_id && String(t.video_id).length >= 8) return String(t.video_id);
  if (t.videoId && String(t.videoId).length >= 8) return String(t.videoId);
  const id = String(t.id || '');
  if (id.startsWith('trk_yt_')) {
    const candidate = id.replace('trk_yt_', '');
    if (candidate.length >= 8) return candidate;
  }
  if (id.startsWith('yt_')) {
    const candidate = id.replace('yt_', '');
    if (candidate.length >= 8) return candidate;
  }
  const audioUrl = String(t.audio_url || t.audioUrl || '');
  const match = audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{8,15})/);
  if (match) return match[1];
  return undefined;
}

// In production on flontmie.ticketplaster.com, use relative /phpbackend/api.
// In dev or preview environments, connect directly to the live backend with full CORS support.
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'flontmie.ticketplaster.com'
  ? 'https://flontmie.ticketplaster.com/phpbackend/api'
  : '/phpbackend/api';

class ApiService {
  private token: string | null = null;
  private csrfToken: string | null = null;

  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('flontmie_token') : null;
    this.csrfToken = typeof window !== 'undefined' ? localStorage.getItem('flontmie_csrf') : null;
  }

  public setToken(token: string | null, csrfToken?: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('flontmie_token', token);
    } else {
      localStorage.removeItem('flontmie_token');
    }

    if (csrfToken !== undefined) {
      this.csrfToken = csrfToken;
      if (csrfToken) {
        localStorage.setItem('flontmie_csrf', csrfToken);
      } else {
        localStorage.removeItem('flontmie_csrf');
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCsrfToken(): string | null {
    return this.csrfToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  // --- HEALTH & STATUS ---
  public async getHealth() {
    return this.request<{ status: string; db_status: string; table_counts: Record<string, number> }>('/health.php');
  }

  // --- TRACKS ---
  public async getTracks(params?: { genre?: string; q?: string; artist_id?: string }): Promise<Track[]> {
    try {
      const query = new URLSearchParams();
      if (params?.genre) query.append('genre', params.genre);
      if (params?.q) query.append('q', params.q);
      if (params?.artist_id) query.append('artist_id', params.artist_id);

      const res = await this.request<{ status: string; tracks: any[] }>(`/tracks.php?${query.toString()}`);
      if (res && Array.isArray(res.tracks) && res.tracks.length > 0) {
        return res.tracks
          .filter(t => !String(t.audio_url || '').includes('soundhelix'))
          .map(t => this.mapBackendTrack(t));
      }
    } catch (e) {
      console.warn('Backend tracks fetch error, falling back:', e);
    }
    return [];
  }

  private mapBackendTrack(t: any): Track {
    const dur = Number(t.duration) || 180;
    const vid = extractVideoId(t);
    const rawCover = String(t.cover_art_url || t.coverUrl || '').startsWith('/phpbackend/api/')
      ? `${API_BASE}${String(t.cover_art_url || t.coverUrl).replace('/phpbackend/api', '')}`
      : (t.cover_art_url || t.coverUrl || `${API_BASE}/stream.php?type=artwork&id=${encodeURIComponent(t.id)}`);
    return {
      id: t.id,
      title: t.title,
      artist: t.artist_name || t.artist || 'Artist',
      artistId: t.artist_id || t.artistId || '',
      album: t.album_name || t.album || 'Single',
      duration: dur,
      genre: t.genre || 'Pop',
      coverUrl: resolveArtworkUrl(rawCover, 'track', t.title),
      audioUrl: `${API_BASE}/stream.php?id=${encodeURIComponent(t.id)}`,
      videoId: vid,
      streams: Number(t.stream_count ?? t.streams) || 0,
      ytPlays: t.yt_plays ?? t.ytPlays ?? null,
      flontmiePlays: typeof t.flontmie_plays === 'number' ? t.flontmie_plays : (Number(t.flontmie_plays) || 0),
      likes: Number(t.likes_count ?? t.likes) || 0,
      releaseDate: t.release_date || new Date().toISOString().split('T')[0],
      lyrics: parseLyricsToLines(t.lyrics, dur),
      isrc: t.isrc || 'USFLM2026001',
      upc: t.upc || '012345678901',
      label: t.label_name || 'Flontmie Verified Catalog',
      distributor: 'Flontmie Catalog Hub',
      isExplicit: Boolean(Number(t.explicit ?? t.isExplicit ?? 0)),
      bpm: Number(t.bpm) || 120,
      moods: ['trending', 'party'] as any[],
      moodTags: t.mood_tags || [t.genre || 'Pop']
    };
  }

  public async registerStream(trackId: string): Promise<void> {
    try {
      await this.request(`/tracks.php?action=stream&id=${encodeURIComponent(trackId)}`, {
        method: 'POST'
      });
    } catch (e) {
      console.warn('Stream count API register error:', e);
    }
  }

  public async toggleLike(trackId: string): Promise<{ liked: boolean }> {
    try {
      const res = await this.request<{ liked: boolean }>(`/tracks.php?action=like&id=${encodeURIComponent(trackId)}`, {
        method: 'POST'
      });
      return res;
    } catch (e) {
      return { liked: false };
    }
  }

  // --- ARTISTS ---
  private mapBackendArtist(a: any): ArtistProfile {
    const popularSongs: Track[] = Array.isArray(a.popular_songs || a.tracks)
      ? (a.popular_songs || a.tracks).map((t: any) => this.mapBackendTrack(t))
      : [];

    const mapDiscItem = (item: any, defaultType: ArtistDiscographyItem['type'] = 'Album'): ArtistDiscographyItem => ({
      id: item.id || item.browse_id || `rel_${Math.random().toString(36).slice(2, 8)}`,
      browseId: item.browse_id || item.browseId,
      collectionId: item.collection_id || item.collectionId,
      title: item.title || 'Release',
      artist: item.artist || a.name || 'Artist',
      artistId: item.artist_id || a.id,
      year: item.year ? String(item.year) : (item.release_date ? String(item.release_date).slice(0, 4) : undefined),
      releaseDate: item.release_date,
      type: item.type || defaultType,
      subtitle: item.subtitle,
      coverUrl: resolveArtworkUrl(item.cover_url || item.cover_art_url || item.coverUrl, 'album', item.title),
      trackCount: item.track_count ? Number(item.track_count) : undefined,
      explicit: Boolean(item.explicit)
    });

    const albums: ArtistDiscographyItem[] = Array.isArray(a.albums)
      ? a.albums.map((alb: any) => mapDiscItem(alb, 'Album'))
      : [];

    const singlesEps: ArtistDiscographyItem[] = Array.isArray(a.singles_eps)
      ? a.singles_eps.map((s: any) => mapDiscItem(s, 'Single'))
      : [];

    const featuredOn: ArtistDiscographyItem[] = Array.isArray(a.featured_on)
      ? a.featured_on.map((f: any) => mapDiscItem(f, 'Playlist'))
      : [];

    const playlists: ArtistDiscographyItem[] = Array.isArray(a.playlists)
      ? a.playlists.map((p: any) => mapDiscItem(p, 'Playlist'))
      : [];

    const relatedArtists: RelatedArtistItem[] = Array.isArray(a.related_artists)
      ? a.related_artists.map((r: any) => ({
          id: r.id || r.browse_id,
          browseId: r.browse_id || r.id,
          name: r.name,
          avatarUrl: resolveArtworkUrl(r.avatar_url || r.avatarUrl, 'artist', r.name),
          subscribers: r.subscribers || r.monthly_audience || undefined,
          monthlyAudience: r.monthly_audience || undefined
        }))
      : [];

    const genresList = Array.isArray(a.genres) ? a.genres : [];

    return {
      id: a.id,
      name: a.name,
      avatarUrl: resolveArtworkUrl(a.avatar_url || a.avatarUrl, 'artist', a.name),
      headerUrl: resolveArtworkUrl(a.header_url || a.headerUrl || a.avatar_url, 'artist', a.name),
      bio: a.bio || '',
      bioSource: a.bio_source || undefined,
      bioUrl: a.bio_url || undefined,
      wikidataId: a.wikidata_id || undefined,
      ytBrowseId: a.yt_browse_id || undefined,
      verified: Boolean(Number(a.verified ?? 1)),
      monthlyListeners: a.monthly_listeners !== null && a.monthly_listeners !== undefined && Number(a.monthly_listeners) > 0
        ? Number(a.monthly_listeners)
        : null,
      ytMonthlyAudience: a.yt_monthly_audience || null,
      ytSubscribers: a.yt_subscribers || null,
      ytTotalViews: a.yt_total_views || null,
      totalStreams: a.total_streams !== null && a.total_streams !== undefined && Number(a.total_streams) > 0
        ? Number(a.total_streams)
        : null,
      flontmieStreams: typeof a.flontmie_streams === 'number' ? a.flontmie_streams : 0,
      followers: a.followers !== null && a.followers !== undefined && Number(a.followers) > 0
        ? Number(a.followers)
        : null,
      flontmieFollowers: typeof a.flontmie_followers === 'number' ? a.flontmie_followers : (Number(a.followers) || 0),
      label: a.label_name || a.label || 'Official Artist',
      topTracks: popularSongs.map(s => s.id),
      popularSongs,
      albums,
      singlesEps,
      featuredOn,
      playlists,
      relatedArtists,
      primaryGenre: genresList[0] || a.primaryGenre || 'Music',
      country: a.country || 'US',
      socialLinks: a.social_links || {},
      distributorName: a.distributor_name || 'YouTube Music Global Feed',
      claimedStatus: a.claimed_status || 'Verified'
    };
  }

  public async getArtists(): Promise<ArtistProfile[]> {
    try {
      const res = await this.request<{ status: string; artists: any[] }>('/artists.php');
      if (res && Array.isArray(res.artists)) {
        return res.artists.map(a => this.mapBackendArtist(a));
      }
    } catch (e) {
      console.warn('Backend artists fetch error:', e);
    }
    return [];
  }

  public async getArtistById(id: string): Promise<ArtistProfile | null> {
    try {
      const res = await this.request<{ status: string; artist: any }>(`/artists.php?id=${encodeURIComponent(id)}`);
      if (res && res.artist) {
        return this.mapBackendArtist(res.artist);
      }
    } catch (e) {
      console.warn('Backend single artist fetch error:', e);
    }
    return null;
  }

  public async getReleaseTracks(browseId: string, title?: string, artist?: string, coverUrl?: string): Promise<{
    title: string;
    artist: string;
    coverUrl: string;
    tracks: Track[];
  } | null> {
    try {
      const q = new URLSearchParams({ action: 'release' });
      if (browseId) q.append('browse_id', browseId);
      if (title) q.append('title', title);
      if (artist) q.append('artist', artist);
      if (coverUrl) q.append('cover_url', coverUrl);

      const res = await this.request<{ status: string; release: any }>(`/artists.php?${q.toString()}`);
      if (res && res.release) {
        const r = res.release;
        return {
          title: r.title || title || 'Release',
          artist: r.artist || artist || 'Artist',
          coverUrl: resolveArtworkUrl(r.cover_url || coverUrl, 'album', r.title || title),
          tracks: Array.isArray(r.tracks) ? r.tracks.map((t: any) => this.mapBackendTrack(t)) : []
        };
      }
    } catch (e) {
      console.warn('Backend release tracks fetch error:', e);
    }
    return null;
  }

  // --- ALBUMS (DATABASE-DRIVEN) ---
  public async getAlbums(): Promise<any[]> {
    try {
      const res = await this.request<{ status: string; albums: any[] }>('/albums.php');
      if (res && Array.isArray(res.albums)) {
        return res.albums.map(alb => ({
          ...alb,
          cover_art_url: resolveArtworkUrl(alb.cover_art_url, 'album', alb.title)
        }));
      }
    } catch (e) {
      console.warn('Backend albums fetch error:', e);
    }
    return [];
  }

  public async getAlbumById(id: string): Promise<any | null> {
    try {
      const res = await this.request<{ status: string; album: any }>(`/albums.php?id=${encodeURIComponent(id)}`);
      if (res && res.album) {
        return {
          ...res.album,
          cover_art_url: resolveArtworkUrl(res.album.cover_art_url, 'album', res.album.title)
        };
      }
    } catch (e) {
      console.warn('Backend album detail fetch error:', e);
    }
    return null;
  }

  // --- PLAYLISTS ---
  public async getPlaylists(): Promise<Playlist[]> {
    try {
      const res = await this.request<{ status: string; playlists: any[] }>('/playlists.php');
      if (res && Array.isArray(res.playlists)) {
        return res.playlists.map(p => {
          let trackIds: string[] = [];
          if (Array.isArray(p.track_ids)) {
            trackIds = p.track_ids;
          } else if (Array.isArray(p.track_ids_json)) {
            trackIds = p.track_ids_json;
          } else if (typeof p.track_ids_json === 'string' && p.track_ids_json.trim()) {
            try {
              const parsed = JSON.parse(p.track_ids_json);
              trackIds = Array.isArray(parsed) ? parsed : [];
            } catch {
              trackIds = [];
            }
          }

          const pid = String(p.id || '');
          let genreCat = p.genre_category || p.category;
          if (!genreCat) {
            if (pid.includes('love') || pid.includes('rnb')) genreCat = 'love_songs';
            else if (pid.includes('old')) genreCat = 'old_school';
            else if (pid.includes('work') || pid.includes('rap')) genreCat = 'workout';
            else if (pid.includes('focus') || pid.includes('chill')) genreCat = 'coding';
            else if (pid.includes('road') || pid.includes('pop')) genreCat = 'road_trip';
            else genreCat = 'all';
          }

          return {
            id: pid,
            title: p.title || 'Curated Collection',
            description: p.description || '',
            coverUrl: resolveArtworkUrl(p.cover_art_url, 'playlist', p.title),
            curator: p.curator || 'Flontmie Editorial',
            trackIds,
            category: (p.category || 'trending') as any,
            genreCategory: genreCat,
            isPublic: Boolean(Number(p.is_public ?? 1)),
            isCollaborative: Boolean(Number(p.is_collaborative ?? 0)),
            followers: Number(p.saves_count ?? p.followers) || 0,
            createdAt: p.created_at || new Date().toISOString().split('T')[0]
          };
        });
      }
    } catch (e) {
      console.warn('Backend playlists fetch error:', e);
    }
    return [];
  }

  public async getPlaylistById(id: string): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
    try {
      const res = await this.request<{ status: string; playlist: any }>(`/playlists.php?id=${encodeURIComponent(id)}`);
      if (res && res.playlist) {
        const p = res.playlist;
        let trackIds: string[] = [];
        if (Array.isArray(p.track_ids)) {
          trackIds = p.track_ids;
        } else if (typeof p.track_ids_json === 'string' && p.track_ids_json.trim()) {
          try {
            const parsed = JSON.parse(p.track_ids_json);
            trackIds = Array.isArray(parsed) ? parsed : [];
          } catch {
            trackIds = [];
          }
        }

        const rawTracks = Array.isArray(p.tracks) ? p.tracks : [];
        const mappedTracks: Track[] = rawTracks
          .filter((t: any) => !String(t.audio_url || '').includes('soundhelix'))
          .map((t: any) => {
            const dur = Number(t.duration) || 180;
            const vid = extractVideoId(t);
            return {
              id: t.id,
              title: t.title,
              artist: t.artist_name || t.artist || 'Unknown Artist',
              artistId: t.artist_id || 'art_unknown',
              album: t.album_name || t.album || 'Single',
              duration: dur,
              genre: t.genre || 'Pop',
              coverUrl: String(t.cover_art_url || t.coverUrl || '').startsWith('/phpbackend/api/')
                ? `${API_BASE}${String(t.cover_art_url || t.coverUrl).replace('/phpbackend/api', '')}`
                : (t.cover_art_url || t.coverUrl || `${API_BASE}/stream.php?type=artwork&id=${encodeURIComponent(t.id)}`),
              audioUrl: `${API_BASE}/stream.php?id=${encodeURIComponent(t.id)}`,
              videoId: vid,
              streams: Number(t.stream_count || t.streams || 0),
              likes: Number(t.likes_count || t.likes || 0),
              releaseDate: t.release_date || new Date().toISOString().split('T')[0],
              lyrics: parseLyricsToLines(t.lyrics, dur),
              isrc: t.isrc || 'USFLM2026001',
              upc: '012345678901',
              label: 'YouTube Music / Flontmie',
              distributor: 'YouTube Music Global Feed',
              isExplicit: Boolean(Number(t.explicit)),
              scale: t.scale,
              bpm: Number(t.bpm) || 120,
              moods: ['trending', 'party'] as any[],
              moodTags: t.mood_tags || [t.genre || 'Pop']
            };
          });

        const pid = String(p.id || '');
        let genreCat = p.genre_category || p.category;
        if (!genreCat) {
          if (pid.includes('love')) genreCat = 'love_songs';
          else if (pid.includes('old')) genreCat = 'old_school';
          else if (pid.includes('work')) genreCat = 'workout';
          else if (pid.includes('focus') || pid.includes('chill')) genreCat = 'coding';
          else if (pid.includes('road')) genreCat = 'road_trip';
          else genreCat = 'all';
        }

        return {
          playlist: {
            id: pid,
            title: p.title || 'Curated Collection',
            description: p.description || '',
            coverUrl: p.cover_art_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
            curator: p.curator || 'Flontmie Editorial',
            trackIds,
            category: (p.category || 'trending') as any,
            genreCategory: genreCat,
            isPublic: Boolean(Number(p.is_public ?? 1)),
            isCollaborative: Boolean(Number(p.is_collaborative ?? 0)),
            followers: Number(p.followers) || 142000,
            createdAt: p.created_at || new Date().toISOString().split('T')[0]
          },
          tracks: mappedTracks
        };
      }
    } catch (e) {
      console.warn('Backend single playlist fetch error:', e);
    }
    return null;
  }

  // --- AUTH ---
  public async login(login: string, password: string) {
    const res = await this.request<{
      status: string;
      token: string;
      csrf_token?: string;
      must_change_password?: boolean;
      user: any;
    }>('/auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
    if (res.token) {
      this.setToken(res.token, res.csrf_token || res.user?.csrf_token || null);
    }
    return res;
  }

  public async register(payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: string;
    country: string;
  }) {
    const res = await this.request<{
      status: string;
      token: string;
      csrf_token?: string;
      verification_code_sent?: boolean;
      user: any;
    }>('/auth.php?action=register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      this.setToken(res.token, res.csrf_token || res.user?.csrf_token || null);
    }
    return res;
  }

  public async logout() {
    try {
      await this.request('/auth.php?action=logout', { method: 'POST' });
    } catch {}
    this.setToken(null, null);
  }

  public async getCurrentUser() {
    const res = await this.request<{
      status: string;
      user: any;
      csrf_token?: string;
      must_change_password?: boolean;
    }>('/auth.php?action=me');
    if (res?.csrf_token) {
      this.setToken(this.token, res.csrf_token);
    }
    return res;
  }

  public async verifyEmail(email: string, code: string) {
    return this.request<{ status: string; message: string }>('/auth.php?action=verify_email', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });
  }

  public async resendVerification(email: string) {
    return this.request<{ status: string; message: string }>('/auth.php?action=resend_verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public async forgotPassword(email: string) {
    return this.request<{ status: string; message: string }>('/auth.php?action=forgot_password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public async resetPassword(email: string, code: string, newPassword: string) {
    return this.request<{ status: string; message: string }>('/auth.php?action=reset_password', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password: newPassword })
    });
  }

  public async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ status: string; message: string; must_change_password?: boolean }>('/auth.php?action=change_password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
  }

  public async updateProfile(payload: { display_name?: string; country?: string; avatar_url?: string }) {
    return this.request<{ status: string; message: string; user: any }>('/auth.php?action=update_profile', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // --- DISTRIBUTOR & CLAIMS ---
  public async getDistributorClaims() {
    return this.request<{ status: string; claims: any[] }>('/distributor.php?action=claims');
  }

  public async reviewClaim(claimId: string, decision: 'approved' | 'rejected' | 'escalated', notes?: string) {
    return this.request<{ status: string; message: string }>('/distributor.php?action=review_claim', {
      method: 'POST',
      body: JSON.stringify({ claim_id: claimId, decision, notes })
    });
  }

  public async submitArtistClaim(artistId: string, evidenceType: string, evidenceDetails: string, proofUrl?: string) {
    return this.request<{ status: string; message: string; claim_id: string }>(`/artists.php?action=claim&id=${encodeURIComponent(artistId)}`, {
      method: 'POST',
      body: JSON.stringify({
        evidence_type: evidenceType,
        evidence_details: evidenceDetails,
        proof_url: proofUrl
      })
    });
  }

  // --- ADMIN GOVERNANCE API (/phpbackend/api/admin.php) ---
  public async getAdminDashboard() {
    return this.request<{
      status: string;
      stats: any;
      users: any[];
      artists: any[];
      claims: any[];
      tracks: any[];
      albums: any[];
      playlists: any[];
      distributors: any[];
      labels: any[];
      role_permissions: any[];
      reports: any[];
      genres: any[];
      settings: any[];
      import_jobs: any[];
      import_schedules: any[];
      storage: any;
      audit_logs: any[];
      sessions: any[];
      security_events: any[];
      analytics: any;
    }>('/admin.php?action=dashboard');
  }

  public async getAdminStats() {
    return this.request<{ status: string; stats: any }>('/admin.php?action=stats');
  }

  public async getAdminUsers(params?: { q?: string; role?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.q) query.append('q', params.q);
    if (params?.role) query.append('role', params.role);
    if (params?.status) query.append('status', params.status);
    return this.request<{ status: string; users: any[] }>(`/admin.php?action=users&${query.toString()}`);
  }

  public async updateUserRole(userId: string, role: string) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_user', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role })
    });
  }

  public async updateAdminUser(payload: {
    user_id: string;
    role?: string;
    status?: 'active' | 'suspended' | 'banned';
    display_name?: string;
    email_verified?: boolean;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_user', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async createAdminUser(payload: {
    email: string;
    display_name: string;
    username?: string;
    password: string;
    role: string;
    country?: string;
    must_change_password?: boolean;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=create_user', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async reviewAdminClaim(payload: {
    claim_id: string;
    decision: 'approved' | 'rejected' | 'escalated' | 'disputed';
    notes?: string;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=review_claim', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateAdminArtist(payload: {
    artist_id: string;
    name?: string;
    verified?: boolean;
    claimed_status?: string;
    label_name?: string;
    bio?: string;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_artist', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateAdminTrack(payload: {
    track_id: string;
    title?: string;
    artist_name?: string;
    album_name?: string;
    genre?: string;
    country?: string;
    release_year?: number;
    cover_art_url?: string;
    status?: string;
    license_status?: string;
    license_notes?: string;
    featured_on_home?: boolean;
    delete_permanently?: boolean;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_track', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async bulkUpdateAdminTracks(trackIds: string[], bulkAction: 'publish' | 'unpublish' | 'verify_license' | 'resync_audio' | 'delete') {
    return this.request<{ status: string; affected_count: number; message: string }>('/admin.php?action=bulk_update_tracks', {
      method: 'POST',
      body: JSON.stringify({ track_ids: trackIds, bulk_action: bulkAction })
    });
  }

  public async updateAdminAlbum(payload: {
    album_id: string;
    title?: string;
    status?: string;
    delete?: boolean;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_album', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateAdminDistributor(payload: {
    id?: string;
    name?: string;
    contact_email?: string;
    status?: string;
    quota_type?: string;
    can_direct_upload?: boolean;
    can_edit_metadata?: boolean;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_distributor', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateAdminLabel(payload: {
    id?: string;
    name?: string;
    contact_email?: string;
    country?: string;
    status?: string;
    can_manage_roster?: boolean;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_label', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateAdminRolePermission(payload: any) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_role_permission', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async resolveAdminReport(payload: {
    report_id: string;
    status: string;
    resolution_notes?: string;
    enforce_action?: string;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=resolve_report', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async createAdminReport(payload: {
    target_type: string;
    target_id: string;
    target_name: string;
    category: string;
    reason: string;
    reporter_email?: string;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=create_report', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateAdminPlaylist(payload: {
    playlist_id: string;
    title?: string;
    description?: string;
    genre_category?: string;
    is_featured?: boolean;
    status?: string;
    delete?: boolean;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_playlist', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async saveAdminGenre(payload: {
    id?: string;
    name: string;
    description?: string;
    is_featured?: boolean;
    display_order?: number;
  }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=save_genre', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateAdminSettings(settings: Record<string, string | boolean>) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_settings', {
      method: 'POST',
      body: JSON.stringify({ settings })
    });
  }

  public async revokeAdminSession(payload: { session_id?: string; user_id?: string }) {
    return this.request<{ status: string; message: string }>('/admin.php?action=revoke_session', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async unlockAdminUser(userId: string) {
    return this.request<{ status: string; message: string }>('/admin.php?action=unlock_user', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId })
    });
  }

  // --- ADMIN-ONLY YOUTUBE MUSIC DISCOVERY & IMPORT PIPELINE API ---
  public async searchYouTubeMusic(
    query: string,
    filter?: 'songs' | 'artists' | 'albums' | 'playlists' | 'all',
    options?: { country?: string; year?: string; genre?: string }
  ) {
    const params = new URLSearchParams();
    params.append('action', 'search');
    params.append('q', query);
    if (filter && filter !== 'all') params.append('filter', filter);
    if (options?.country) params.append('country', options.country);
    if (options?.year && options.year !== 'All') params.append('year', options.year);
    if (options?.genre && options.genre !== 'All') params.append('genre', options.genre);

    return this.request<{
      status: string;
      query: string;
      effective_query?: string;
      country?: string;
      year?: string;
      genre?: string;
      results: {
        songs: any[];
        artists: any[];
        albums: any[];
        playlists: any[];
      };
      total_count: number;
    }>(`/youtube_music.php?${params.toString()}`);
  }

  public async getYouTubeMusicCharts() {
    return this.request<{
      status: string;
      count: number;
      charts: Array<{
        id: string;
        videoId?: string;
        title: string;
        artist: string;
        cover_url: string;
        shelf: string;
        streams: number;
      }>;
    }>('/youtube_music.php?action=charts');
  }

  public async getYouTubeMusicMoods() {
    return this.request<{
      status: string;
      count: number;
      moods_and_genres: Array<{
        name: string;
        browseId: string;
        color: string;
      }>;
    }>('/youtube_music.php?action=moods');
  }

  public async getYouTubeMusicLyrics(videoId: string) {
    return this.request<{
      status: string;
      videoId: string;
      lyrics: string;
      source: string;
    }>(`/youtube_music.php?action=lyrics&videoId=${encodeURIComponent(videoId)}`);
  }

  public async importYouTubeMusicTrack(trackData: {
    title: string;
    artist: string;
    album?: string;
    genre?: string;
    country?: string;
    release_year?: number;
    release_date?: string;
    duration?: number;
    cover_url?: string;
    audio_url?: string;
    videoId?: string;
    lyrics?: string;
    license_status?: string;
    auto_publish?: boolean;
    force_resync?: boolean;
  }) {
    return this.request<{
      status: string;
      job_id?: string;
      track_id?: string;
      audio_method?: string;
      file_size_bytes?: number;
      message: string;
      track?: Track;
    }>('/youtube_music.php?action=import', {
      method: 'POST',
      body: JSON.stringify(trackData)
    });
  }

  public async bulkImportYouTubeMusicTracks(payload: {
    items: any[];
    genre?: string;
    country?: string;
    license_status?: string;
    auto_publish?: boolean;
    force_resync?: boolean;
  }) {
    return this.request<{
      status: string;
      batch_id: string;
      imported_count: number;
      skipped_count: number;
      failed_count: number;
      message: string;
      results: any[];
    }>('/youtube_music.php?action=bulk_import', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async importYouTubeMusicCollection(payload: {
    collection_type: 'album' | 'artist' | 'playlist';
    title: string;
    artist?: string;
    cover_url?: string;
    description?: string;
    genre?: string;
    country?: string;
    license_status?: string;
    tracks: any[];
  }) {
    return this.request<{
      status: string;
      batch_id: string;
      imported_count: number;
      skipped_count: number;
      playlist_id?: string;
      message: string;
    }>('/youtube_music.php?action=import_collection', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async retryImportJob(jobId: string) {
    return this.request<{ status: string; message: string; result?: any }>('/youtube_music.php?action=retry_job', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId })
    });
  }

  public async cancelImportJob(jobId: string) {
    return this.request<{ status: string; message: string }>('/youtube_music.php?action=cancel_job', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId })
    });
  }

  public async createImportSchedule(payload: {
    name: string;
    search_query: string;
    filter_type?: string;
    genre?: string;
    country?: string;
    release_year?: string;
    max_items?: number;
    auto_publish?: boolean;
    license_status?: string;
    frequency?: string;
  }) {
    return this.request<{ status: string; message: string; schedule_id: string }>('/youtube_music.php?action=create_schedule', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async toggleImportSchedule(scheduleId: string) {
    return this.request<{ status: string; message: string }>('/youtube_music.php?action=toggle_schedule', {
      method: 'POST',
      body: JSON.stringify({ schedule_id: scheduleId })
    });
  }

  public async deleteImportSchedule(scheduleId: string) {
    return this.request<{ status: string; message: string }>('/youtube_music.php?action=delete_schedule', {
      method: 'POST',
      body: JSON.stringify({ schedule_id: scheduleId })
    });
  }

  public async runImportSchedule(scheduleId: string) {
    return this.request<{ status: string; imported_count: number; skipped_count: number; message: string }>('/youtube_music.php?action=run_schedule', {
      method: 'POST',
      body: JSON.stringify({ schedule_id: scheduleId })
    });
  }

  public async syncAllStorage() {
    return this.request<{ status: string; synced_count: number; storage: any; message: string }>('/youtube_music.php?action=sync_all_storage', {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  public async uploadMediaFile(file: File, type: 'audio' | 'artwork' = 'audio', trackId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (trackId) formData.append('track_id', trackId);
    if (this.csrfToken) formData.append('csrf_token', this.csrfToken);

    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;

    const response = await fetch(`${API_BASE}/upload.php`, {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
    }
    return data as {
      status: string;
      message: string;
      url: string;
      track_id?: string;
      size: number;
      format: string;
      type: string;
    };
  }

  public async getYouTubeMusicArtist(browseId: string, name?: string) {
    const params = new URLSearchParams();
    if (browseId) params.append('browseId', browseId);
    if (name) params.append('name', name);
    return this.request<{
      status: string;
      artist: {
        name: string;
        subscribers: string;
        description: string;
        avatar_url: string;
      };
      top_songs: Array<{
        id: string;
        videoId?: string;
        title: string;
        artist: string;
        cover_url: string;
        duration: number;
        plays: string;
      }>;
      albums: Array<{
        id: string;
        browseId: string;
        title: string;
        artist: string;
        year: string;
        cover_url: string;
      }>;
      singles: Array<{
        id: string;
        browseId: string;
        title: string;
        artist: string;
        year: string;
        cover_url: string;
      }>;
    }>(`/youtube_music.php?action=artist&${params.toString()}`);
  }

  public async getYouTubeMusicAlbum(browseId: string) {
    return this.request<{
      status: string;
      album: {
        id: string;
        title: string;
        artist: string;
        year: string;
        cover_url: string;
        tracks: Array<{
          id: string;
          videoId?: string;
          title: string;
          artist: string;
          duration_text?: string;
          duration: number;
          cover_url: string;
        }>;
      };
    }>(`/youtube_music.php?action=album&browseId=${encodeURIComponent(browseId)}`);
  }

  public async getYouTubeMusicPlaylist(browseId: string) {
    return this.request<{
      status: string;
      playlist: {
        id: string;
        title: string;
        curator: string;
        description: string;
        cover_url: string;
        tracks: Array<{
          id: string;
          videoId?: string;
          title: string;
          artist: string;
          cover_url: string;
          duration: number;
        }>;
      };
    }>(`/youtube_music.php?action=playlist&browseId=${encodeURIComponent(browseId)}`);
  }

  // Fallback public music search
  public async searchPublicMusic(query: string) {
    return this.searchYouTubeMusic(query);
  }

  public async importPublicTrack(trackData: any) {
    return this.importYouTubeMusicTrack(trackData);
  }
}

export const api = new ApiService();
