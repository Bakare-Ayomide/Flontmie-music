/**
 * Flontmie Production API Client
 * Connects frontend directly to the PHP / MySQL backend
 */

import { Track, Playlist, ArtistProfile } from '../types/music';

// In production, API is served under /phpbackend/api
const API_BASE = '/phpbackend/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('flontmie_token') : null;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('flontmie_token', token);
    } else {
      localStorage.removeItem('flontmie_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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
        return res.tracks.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist_name,
          artistId: t.artist_id,
          album: t.album_name || 'Single',
          duration: Number(t.duration) || 180,
          genre: t.genre,
          coverUrl: t.cover_art_url,
          audioUrl: t.audio_url,
          streams: Number(t.stream_count) || 0,
          likes: Number(t.likes_count) || 0,
          releaseDate: t.release_date,
          lyrics: t.lyrics,
          isrc: t.isrc,
          isExplicit: Boolean(Number(t.explicit)),
          scale: t.scale,
          bpm: Number(t.bpm) || 120,
          moodTags: t.mood_tags || [t.genre]
        }));
      }
    } catch (e) {
      console.warn('Backend tracks fetch error, falling back:', e);
    }
    return [];
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
  public async getArtists(): Promise<ArtistProfile[]> {
    try {
      const res = await this.request<{ status: string; artists: any[] }>('/artists.php');
      if (res && Array.isArray(res.artists)) {
        return res.artists.map(a => ({
          id: a.id,
          name: a.name,
          avatarUrl: a.avatar_url,
          headerUrl: a.header_url,
          bio: a.bio,
          verified: Boolean(Number(a.verified)),
          monthlyListeners: Number(a.monthly_listeners) || 0,
          totalStreams: Number(a.total_streams) || 0,
          followers: Number(a.followers) || 0,
          label: a.label_name || 'Independent',
          topTracks: [],
          albums: [],
          genres: a.genres || [],
          country: 'NG',
          socialLinks: a.social_links || {},
          distributorName: a.distributor_name || 'TuneCore Direct',
          claimedStatus: a.claimed_status || 'unclaimed',
          claimedUserId: a.claimed_user_id
        }));
      }
    } catch (e) {
      console.warn('Backend artists fetch error:', e);
    }
    return [];
  }

  // --- PLAYLISTS ---
  public async getPlaylists(): Promise<Playlist[]> {
    try {
      const res = await this.request<{ status: string; playlists: any[] }>('/playlists.php');
      if (res && Array.isArray(res.playlists)) {
        return res.playlists.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          coverUrl: p.cover_art_url,
          curator: 'Flontmie Editorial',
          tracksCount: p.track_count || 0,
          trackIds: JSON.parse(p.track_ids_json || '[]'),
          category: 'featured'
        }));
      }
    } catch (e) {
      console.warn('Backend playlists fetch error:', e);
    }
    return [];
  }

  // --- AUTH ---
  public async login(login: string, password: string) {
    const res = await this.request<{ status: string; token: string; user: any }>('/auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public async getCurrentUser() {
    return this.request<{ status: string; user: any }>('/auth.php?action=me');
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

  // --- ADMIN ---
  public async getAdminStats() {
    return this.request<{ status: string; stats: any }>('/admin.php?action=stats');
  }

  public async getAdminUsers() {
    return this.request<{ status: string; users: any[] }>('/admin.php?action=users');
  }

  public async updateUserRole(userId: string, role: string) {
    return this.request<{ status: string; message: string }>('/admin.php?action=update_role', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role })
    });
  }
}

export const api = new ApiService();
