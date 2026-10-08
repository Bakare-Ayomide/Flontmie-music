export type Persona = 'listener' | 'artist' | 'label' | 'distributor' | 'admin';

export type MoodCategory = 'all' | 'relax' | 'energize' | 'workout' | 'focus' | 'party' | 'romance' | 'oldschool';

export type MusicGenre = 'afrobeat' | 'pop' | 'rap' | 'oldschool' | 'r&b' | 'synthwave' | 'lo-fi' | 'ambient';

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';

export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  coverUrl: string;
  duration: number; // in seconds
  audioKey?: string;
  genre: MusicGenre;
  bpm: number;
  moods: MoodCategory[];
  streams: number;
  likes: number;
  isExplicit?: boolean;
  lyrics?: LyricLine[];
  releaseDate: string;
  isrc: string;
  upc: string;
  label: string;
  distributor: string;
  // Personalization & algorithmic metadata
  country?: string; // ISO 2-letter code e.g. NG, US, UK, JP, DE, BR
  timeOfDayAffinity?: TimeOfDay[];
  resumeProgress?: {
    currentTime: number;
    duration: number;
  };
  seriesInfo?: {
    seriesTitle: string;
    episodeNumber: number;
    season: number;
  };
  listenerTribe?: string;
  algorithmReason?: string;
  status?: 'active' | 'review' | 'flagged';
  featuredOnHome?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  curator: string;
  curatorAvatar?: string;
  isPublic: boolean;
  isCollaborative: boolean;
  collaborators?: string[];
  trackIds: string[];
  followers: number;
  category: MoodCategory;
  genreCategory?: string; // e.g. "love_songs", "old_school", "workout"
  createdAt: string;
  isSeries?: boolean;
  country?: string;
}

export interface ArtistProfile {
  id: string;
  name: string;
  avatarUrl: string;
  headerUrl: string;
  bio: string;
  verified: boolean;
  monthlyListeners: number;
  totalStreams: number;
  followers: number;
  label: string;
  topTracks: string[];
  splitSheets: SplitSheet[];
  country?: string;
  primaryGenre?: string;
}

export interface FeaturedAccount {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  role: 'Artist' | 'Curator' | 'Producer' | 'Label Executive' | 'Top Listener';
  bio: string;
  followers: number;
  isFollowing: boolean;
  verified: boolean;
}

export interface SplitMember {
  id: string;
  name: string;
  role: 'Primary Artist' | 'Featured Artist' | 'Producer' | 'Songwriter' | 'Mix Engineer';
  percentage: number;
  payoutEmail: string;
}

export interface SplitSheet {
  trackId: string;
  trackTitle: string;
  isrc: string;
  members: SplitMember[];
  status: 'active' | 'pending_signature';
}

export interface LabelArtist {
  id: string;
  name: string;
  avatarUrl: string;
  catalogCount: number;
  totalStreams: number;
  monthlyRevenue: number;
  advanceAmount: number;
  recoupedAmount: number;
  status: 'Recouped' | 'In Recoupment' | 'New Signing';
}

export interface ReleaseScheduleItem {
  id: string;
  title: string;
  artistName: string;
  type: 'Single' | 'EP' | 'Album';
  releaseDate: string;
  editorialPitchStatus: 'Drafted' | 'Under Review' | 'Accepted - Mainstage' | 'Live on Radar';
  upc: string;
  coverUrl: string;
}

// Distributor model: Uploading, granting access, and managing music ONTO FLONTMIE
export interface DistributorIngestionItem {
  id: string;
  trackTitle: string;
  artistName: string;
  artistId: string;
  labelName: string;
  isrc: string;
  upc: string;
  genre: MusicGenre;
  releaseDate: string;
  flontmieStatus: 'Live on Flontmie' | 'Ingestion QA' | 'Metadata Processing' | 'Pending Rights Review';
  grantedUploadAccess: boolean;
  uploadedByDistributor: string; // e.g., 'TuneCore Direct', 'CDBaby Gateway', 'Ditto Music Hub'
  audioQuality: 'Lossless Hi-Res' | '24-bit Flac' | 'Standard 320kbps';
}

export interface DistributorAccessGrant {
  id: string;
  entityName: string;
  entityType: 'Artist' | 'Record Label';
  distributorName: string;
  canUploadTracks: boolean;
  canUploadAlbums: boolean;
  canModifyLiveMetadata: boolean;
  maxMonthlyReleases: number;
  status: 'Active' | 'Pending' | 'Revoked';
}

export interface AdminRolePermission {
  role: 'artist' | 'label' | 'distributor' | 'listener';
  name: string;
  description: string;
  canDirectUpload: boolean;
  canEditLiveMetadata: boolean;
  canCreateSplits: boolean;
  canFeatureOnHome: boolean;
  canManageRoster: boolean;
  maxUploadPerMonth: number;
  royaltyPayoutAuthority: boolean;
  requiresAdminApproval: boolean;
}

export interface JamParticipant {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  reaction?: string;
  reactionTimestamp?: number;
}
